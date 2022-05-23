const { rules, items, triggers, time, actions } = require('openhab')
const {
  json_storage,
  DATETIME_FORMAT,
  sync_group_with_semantic_items
} = require(__dirname + '/core-helpers')

let timers = []
const IRRIGATION_TAGS = ['CoreIrrigation']

function scriptLoaded() {
  rules.JSRule({
    name: 'sync_irrigation_helpers',
    description: 'Core (JS) - Sync helper items of irrigation',
    tags: ['core', 'core-irrigation'],
    triggers: [
      triggers.GenericCronTrigger('30 0/5 * ? * * *'),
      triggers.SystemStartlevelTrigger(100)
    ],
    execute: (event) => {
      // Sync group gCore_Irrigation_Triggers with irrigation items - it's needed to create triggers on it
      sync_group_with_semantic_items(
        'gCore_Irrigation_Triggers',
        undefined,
        IRRIGATION_TAGS
      )
    }
  })

  rules.JSRule({
    name: 'check_irrigation',
    description: 'Core (JS) - Check for irrigation',
    tags: ['core', 'core-irrigation'],
    triggers: [triggers.GroupStateUpdateTrigger('gCore_Irrigation_Triggers')],
    execute: (event) => {
      const now = time.ZonedDateTime.now()

      const lastCheck = json_storage(event.itemName).get(
        'irrigation',
        'last-check'
      )

      const apiKey = json_storage('gCore_Irrigation_Triggers').get(
        'irrigation',
        'api-key'
      )

      const latitude = json_storage('gCore_Irrigation_Triggers').get(
        'irrigation',
        'latitude'
      )

      const longitude = json_storage('gCore_Irrigation_Triggers').get(
        'irrigation',
        'longitude'
      )

      const justChecked =
        lastCheck &&
        time.ZonedDateTime.parse(lastCheck, DATETIME_FORMAT).until(
          now,
          time.ChronoUnit.DAYS
        ) == 0
      if (
        !apiKey ||
        longitude === undefined ||
        latitude == undefined ||
        justChecked
      ) {
        return
      }

      json_storage(event.itemName).set(
        'irrigation',
        'last-check',
        now.format(DATETIME_FORMAT)
      )

      const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&exclude=hourly,minutely,current,alerts&appid=${apiKey}`
      const percipitations = JSON.parse(
        actions.HTTP.sendHttpGetRequest(url, TIMEOUT)
      ).daily.map((data) => data.rain || 0)

      const percipitationDays =
        json_storage(event.itemName).get('irrigation', 'percipitation-days') ||
        7

      const waitDays =
        json_storage(event.itemName).get('irrigation', 'wait-days') || 3

      let historicPercipitation =
        json_storage(event.itemName).get('irrigation', 'history') || []
      historicPercipitation.push(percipitations[0])
      historicPercipitation = historicPercipitation.slice(-percipitationDays)
      json_storage(event.itemName).set(
        'irrigation',
        'history',
        historicPercipitation
      )

      const historicPercipitationLevel =
        historicPercipitation.reduce((a, b) => a + b) /
        historicPercipitation.length

      const futurePercipitation = percipitations.slice(1)

      const estimatedPercipitation = historicPercipitation.concat(
        futurePercipitation.slice(0, waitDays)
      )

      const estimatedPercipitationLevel =
        estimatedPercipitation.reduce((a, b) => a + b) /
        estimatedPercipitation.length

      const aimedPercipitationLevel =
        json_storage(event.itemName).get(
          'irrigation',
          'aimed-percipitation-level'
        ) || 2

      console.log(
        'Aimed: ' + aimedPercipitationLevel,
        ' Current: ' +
          historicPercipitationLevel +
          ' Estimated in ' +
          waitDays +
          ' days: ' +
          estimatedPercipitationLevel
      )

      const lastActivation = json_storage(event.itemName).get(
        'irrigation',
        'last-activation'
      )

      if (
        (!lastActivation ||
          lastActivation.until(now, time.ChronoUnit.DAYS) == 0) &&
        historicPercipitationLevel <= aimedPercipitationLevel &&
        estimatedPercipitationLevel <= aimedPercipitationLevel
      ) {
        const waterVolumePerMinute =
          json_storage(event.itemName).get(
            'irrigation',
            'water-volume-per-minute'
          ) || 0.05

        const irrigationAmount =
          aimedPercipitationLevel -
          Math.max(historicPercipitationLevel, estimatedPercipitationLevel)

        console.log(
          `Irrigating for ${irrigationAmount} (${
            irrigationAmount / waterVolumePerMinute
          } minutes)`
        )

        json_storage(event.itemName).set(
          'irrigation',
          'last-activation',
          now.format(DATETIME_FORMAT)
        )

        historicPercipitation[historicPercipitation.length - 1] +=
          irrigationAmount
        json_storage(event.itemName).set(
          'irrigation',
          'history',
          historicPercipitation
        )

        items.getItem(itemName).sendCommand('ON')

        timers.push(
          (function (itemName) {
            const func = () => {
              // STOP IRRIGATING
              console.log(`Stop irrigating of valve ${itemName}`)
              items.getItem(itemName).sendCommand('OFF')
            }
            const timer = setTimeout(
              func,
              (irrigationAmount / waterVolumePerMinute) * 60 * 1000
            )
            return {
              clear: () => {
                func()
                clearTimeout(timer)
              }
            }
          })(event.itemName)
        )
      }
    }
  })
}

function scriptUnloaded() {
  // Close valves
  for (const timer of timers) {
    timer.clear()
  }
}
