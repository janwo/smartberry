const { rules, items, triggers, osgi, time, actions } = require('openhab')
const { DATETIME_FORMAT } = require(__dirname + '/core-helpers')

const ThingRegistry = osgi.getService('org.openhab.core.thing.ThingRegistry')
const ThingStatus = Java.type('org.openhab.core.thing.ThingStatus')
const ItemChannelLinkRegistry = osgi.getService(
  'org.openhab.core.thing.link.ItemChannelLinkRegistry'
)

const ELAPSED_DAYS = 5

const scriptLoaded = function () {
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
      const allThings = ThingRegistry.getAll()
      for (const thing of allThings) {
        if (
          thing.getStatus() != ThingStatus.ONLINE ||
          (thing.getProperties() &&
            thing.getProperties().get('zwave_lastheal') &&
            time.ZonedDateTime.parse(
              thing.getProperties().get('zwave_lastheal'),
              DATETIME_FORMAT
            ).until(time.ZonedDateTime.now(), time.ChronoUnit.DAYS)) >
            ELAPSED_DAYS
        ) {
          for (const channel of thing.getChannels()) {
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
