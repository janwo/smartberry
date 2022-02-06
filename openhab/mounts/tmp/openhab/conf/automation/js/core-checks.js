const { rules, items, triggers, osgi, time, actions } = require('openhab')
const { TemporalUnit } = require('openhab/time')

const ItemChannelLinkRegistry = osgi.getService(
  'org.openhab.core.thing.link.ItemChannelLinkRegistry'
)
const ThingsRegistry = osgi.getService('org.openhab.core.thing.ThingRegistry')

const ELAPSED_DAYS = 5

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
    const allThings = ThingsRegistry.getAll()
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
          for (const item of ItemChannelLinkRegistry.getLinkedItems(
            channel.getUID()
          )) {
            if (!actions.Semantics.isEquipment(item)) {
              item = actions.Semantics.getEquipment(item)
            }

            if (item) {
              item.addGroups(group)
            }
          }
        }
      }
    }
  }
})
