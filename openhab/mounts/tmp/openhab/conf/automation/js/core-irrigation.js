const { rules, items, triggers, time, actions } = require('openhab')
const {
  json_storage,
  DATETIME_FORMAT,
  sync_group_with_semantic_items
} = require(__dirname + '/core-helpers')

let timers = []
const IRRIGATION_TRIGGER_TAGS = ['CoreIrrigationTrigger']
const IRRIGATION_VALVE_TAGS = ['CoreIrrigationValve']

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
        IRRIGATION_TRIGGER_TAGS
      )

      // Sync group gCore_Irrigation_Valves with irrigation items - it's needed to create triggers on it
      sync_group_with_semantic_items(
        'gCore_Irrigation_Valves',
        undefined,
        IRRIGATION_VALVE_TAGS
      )
    }
  })

  rules.JSRule({
    name: 'check_irrigation',
    description: 'Core (JS) - Check for irrigation',
    tags: ['core', 'core-irrigation'],
    triggers: [
      triggers.GroupStateUpdateTrigger('gCore_Irrigation_Triggers'),
      triggers.GroupStateUpdateTrigger('gCore_Irrigation_Valves', 'OFF')
    ],
    execute: (event) => {
      const now = time.ZonedDateTime.now()
      const lastCheck = json_storage('gCore_Irrigation').get(
        'irrigation',
        'last-check'
      )

      const apiKey = json_storage('gCore_Irrigation').get(
        'irrigation',
        'api-key'
      )

      const latitude = json_storage('gCore_Irrigation').get(
        'irrigation',
        'latitude'
      )

      const longitude = json_storage('gCore_Irrigation').get(
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
      const precipitations = JSON.parse(
        actions.HTTP.sendHttpGetRequest(url, TIMEOUT)
      ).daily.map((data) => data.rain || 0)

      for (let valve of items.getItem('gCore_Irrigation_Valves').members) {
        const observedDays = json_storage(event.itemName).get(
          'irrigation',
          'observed-days'
        )

        const overshootDays = json_storage(event.itemName).get(
          'irrigation',
          'overshoot-days'
        )

        const aimedPrecipitationLevel = json_storage(event.itemName).get(
          'irrigation',
          'aimed-precipitation-level'
        )

        let historicPrecipitation =
          json_storage(event.itemName).get('irrigation', 'history') || []
        historicPrecipitation.push(precipitations[0])
        historicPrecipitation = historicPrecipitation.slice(-observedDays)
        json_storage(event.itemName).set(
          'irrigation',
          'history',
          historicPrecipitation
        )

        const historicPrecipitationLevel =
          historicPrecipitation.reduce((a, b) => a + b) /
          historicPrecipitation.length

        const futurePrecipitation = precipitations.slice(1)

        const estimatedPrecipitation = historicPrecipitation.concat(
          futurePrecipitation.slice(0, overshootDays)
        )

        const estimatedPrecipitationLevel =
          estimatedPrecipitation.reduce((a, b) => a + b) /
          estimatedPrecipitation.length

        console.log(
          'Aimed: ' + aimedPrecipitationLevel,
          ' Current: ' +
            historicPrecipitationLevel +
            ' Estimated in ' +
            overshootDays +
            ' days: ' +
            estimatedPrecipitationLevel
        )

        const lastActivation = json_storage(event.itemName).get(
          'irrigation',
          'last-activation'
        )

        if (
          (!lastActivation ||
            lastActivation.until(now, time.ChronoUnit.DAYS) == 0) &&
          historicPrecipitationLevel <= aimedPrecipitationLevel &&
          estimatedPrecipitationLevel <= aimedPrecipitationLevel
        ) {
          const waterVolumePerMinute =
            json_storage(event.itemName).get(
              'irrigation',
              'irrigation-level-per-minute'
            ) || 0.05

          const irrigationAmount =
            aimedPrecipitationLevel -
            Math.max(historicPrecipitationLevel, estimatedPrecipitationLevel)

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

          historicPrecipitation[historicPrecipitation.length - 1] +=
            irrigationAmount
          json_storage(event.itemName).set(
            'irrigation',
            'history',
            historicPrecipitation
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
    }
  })
}

function scriptUnloaded() {
  // Close valves
  for (const timer of timers) {
    timer.clear()
  }
}
