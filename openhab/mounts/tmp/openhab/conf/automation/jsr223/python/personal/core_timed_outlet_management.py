from core.triggers import when
from core.rules import rule
from personal.core_helpers import METADATA_NAMESPACE, get_location, get_random_number
from core.date import minutes_between, format_date, ZonedDateTime
from personal.core_broadcast import broadcast
from core.metadata import set_key_value, get_key_value
from functools import map
from core.items import add_item


@rule("Core - Keep last timed outlet activation updated", description="Keep last timed outlet activation updated.", tags=[])
@when("Member of gTimedOutletManagement_Switchable changed to ON")
def set_last_activation(event):
    set_key_value(
        event.itemName,
        METADATA_NAMESPACE,
        'timed-outlet',
        "last-update",
        format_date(ZonedDateTime.now())
    )


@rule("Core - Manage elapsed outlets", description="Manage elapsed outlets", tags=[])
@when("Time cron 0 * * ? * * *")
@when("Member of gTimedOutletManagement_ActiveDuration received update")
def manage_elapsed(event):
    for switchable in ir.getItem("gTimedOutletManagement_Switchable").members:
        if switchable.state == ON:
            meta = get_key_value(
                switchable.name,
                METADATA_NAMESPACE,
                'timed-outlet'
            )
            activation = meta["last-update"] if meta != None and "last-update" in meta else None
            duration = ir.getItem(
                meta["duration-item"]) if meta != None and "duration-item" in meta else None

            if activation == None or duration == None or isinstance(duration.state, UnDefType):
                broadcast("gTimedOutletManagement_ActiveDuration not found for outlet {}.".format(
                    switchable.name))
                return

            if minutes_between(activation, ZonedDateTime.now()) > duration.state.intValue():
                events.sendCommand(switchable, OFF)


@rule("Core - Create timed outlet helper items", description="Create helper items", tags=[])
@when("Item added")
@when("Item removed")
@when("Item updated")
def create_timed_outlet_helper_items(event):
    def createDurationHelper(timedOutlet):
        meta = get_key_value(
            timedOutlet.name,
            METADATA_NAMESPACE,
            'timed-outlet'
        )

        if meta == None or "duration-item" not in meta:
            durationItem = add_item(
                "Core_TimedOutletManagement_{0}_ActiveDuration-{1}".format(
                    timedOutlet.name,
                    get_random_number(10)
                ),
                item_type="Number",
                category="time",
                groups=[
                    "gTimedOutletManagement_ActiveDuration",
                    "gPersistence_SaveState"
                ],
                label="Einschaltdauer von ${0} [ % d min]".format(
                    timedOutlet.name),
                tags=["Point"]
            )

            set_key_value(
                timedOutlet.name,
                METADATA_NAMESPACE,
                'timed-outlet',
                "duration-item",
                durationItem.name
            )
            return durationItem.name
        return meta["duration-item"]

    durationHelperNames = map(
        lambda switchable: createDurationHelper(switchable),
        ir.getItem("gTimedOutletManagement_Switchable").members
    )

    for helper in ir.getItem("gTimedOutletManagement_ActiveDuration").members:
        if helper.name not in durationHelperNames:
            ir.remove(helper.name)
