const { rules, items, triggers, things, time } = require('openhab')
const { TemporalUnit } = require('openhab/time')

const ITEM_CHANNEL_LINK_REGISTRY = osgi.get_service(
  'org.openhab.core.thing.link.ItemChannelLinkRegistry'
)
const ELAPSED_DAYS = 5

rules.JSRule({
  name: 'offline_check',
  description: 'Core (JS) - Check things for offline state.',
  tags: ['core', 'core-checks'],
  triggers: [triggers.GenericCronTrigger('0 0/5 * * * ?')],
  execute: (event) => {
    const group = items.getItem('gCore_Checks_OfflineThings')
    for (const member of group.members) {
      group.removeMember(member)
    }
    return //TODO: wait for implementation of things.getAll()
    const allThings = things.getAll()
    for (const thing of allThings) {
      if (
        (thing.getStatusInfo() &&
          thing.getStatusInfo().getStatus().toString() != 'ONLINE') ||
        (thing.getProperties() &&
          thing.getProperties().get('zwave_lastheal') &&
          time
            .parse(thing.getProperties().get('zwave_lastheal'))
            .until(time.ZonedDateTime.now(), TemporalUnit.DAYS)) > ELAPSED_DAYS
      ) {
        for (const channel of thing.getChannels()) {
          for (const item of ITEM_CHANNEL_LINK_REGISTRY.getLinkedItems(
            channel.getUID()
          )) {
            if (!Semantics.isEquipment(item)) {
              item = Semantics.getEquipment(item)
            }

            if (item) {
              group.addMember(item)
            }
          }
        }
      }
    }
  }
})
