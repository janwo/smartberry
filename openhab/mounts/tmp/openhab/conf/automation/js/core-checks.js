const { rules, items, things, triggers, osgi, time, actions } = require('openhab')

const ItemChannelLinkRegistry = osgi.getService(
  'org.openhab.core.thing.link.ItemChannelLinkRegistry'
)

const ELAPSED_DAYS = 5
const ZWAVE_DATETIME_FORMAT = time.DateTimeFormatter.ofPattern(
  "yyyy-MM-dd'T'HH:mm:ssX"
)

function scriptLoaded() {
  rules.JSRule({
    name: 'offline_check',
    description: 'Core (JS) - Check things for offline state.',
    tags: ['core', 'core-checks'],
    triggers: [triggers.GenericCronTrigger('0 0/5 * * * ?')],
    execute: (event) => {
      const group = items.getItem('gCore_Checks_OfflineThings')
      for (const member of group.members) {
        member.removeGroups(group)
      }
      const allThings = things.getThings()
      for (const thing of allThings) {
        if (
          thing.status != 'ONLINE' ||
          (thing.rawThing.getProperties() &&
            thing.rawThing.getProperties().get('zwave_lastheal') &&
            time.ZonedDateTime.parse(
              thing.rawThing.getProperties().get('zwave_lastheal'),
              ZWAVE_DATETIME_FORMAT
            ).until(time.ZonedDateTime.now(), time.ChronoUnit.DAYS)) >
            ELAPSED_DAYS
        ) {
          for (const channel of thing.rawThing.getChannels()) {
            for (let item of ItemChannelLinkRegistry.getLinkedItems(
              channel.getUID()
            )) {
              if (!actions.Semantics.isEquipment(item)) {
                item = actions.Semantics.getEquipment(item)
              }

              if (item) {
                items.getItem(item.name).addGroups(group)
              }
            }
          }
        }
      }
    }
  })
}
