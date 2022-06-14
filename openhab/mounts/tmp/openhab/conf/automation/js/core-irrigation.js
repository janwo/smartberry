const { rules, items, triggers, time, actions } = require('openhab')
const {
  json_storage,
  DATETIME_FORMAT,
  sync_group_with_semantic_items
} = require(__dirname + '/core-helpers')

let timers = {}
const IRRIGATION_TRIGGER_TAGS = ['CoreIrrigationTrigger']
const IRRIGATION_VALVE_TAGS = ['CoreIrrigationValve']
const TIMEOUT = 5000

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
    name: 'check_irrigation_valves',
    description: 'Core (JS) - Check for irrigation values',
    tags: ['core', 'core-irrigation'],
    triggers: [
      triggers.GroupStateUpdateTrigger('gCore_Irrigation_Triggers'),
      triggers.GroupStateUpdateTrigger('gCore_Irrigation_Valves', 'OFF')
    ],
    execute: (event) => {
      const now = time.ZonedDateTime.now()
      let precipitations =
        json_storage('gCore_Irrigation').get('irrigation', 'last-forecast') ||
        []

      const valves = items.getItem('gCore_Irrigation_Valves').members
      if (valves.some((valve) => valve.state == 'ON')) {
        return
      }

      for (let valve of valves) {
        const observedDays = json_storage(valve.name).get(
          'irrigation',
          'observed-days'
        )

        const overshootDays = json_storage(valve.name).get(
          'irrigation',
          'overshoot-days'
        )

        const aimedPrecipitationLevel = json_storage(valve.name).get(
          'irrigation',
          'aimed-precipitation-level'
        )

        const waterVolumePerMinute = json_storage(valve.name).get(
          'irrigation',
          'irrigation-level-per-minute'
        )

        if (
          [
            overshootDays,
            observedDays,
            aimedPrecipitationLevel,
            waterVolumePerMinute
          ].some((value) => value === undefined)
        ) {
          console.log(
            'check_irrigation_valves',
            `Some irrigation values of item ${valve.name} are missing.`
          )
          continue
        }

        let historicPrecipitation =
          json_storage(valve.name).get('irrigation', 'history') || []

        const historicPrecipitationLevel = historicPrecipitation.reduce(
          (a, b) => a + b,
          0
        )
        const futurePrecipitation = precipitations.slice(1, overshootDays)
        const estimatedPrecipitation =
          historicPrecipitation.concat(futurePrecipitation)
        const estimatedPrecipitationLevel = estimatedPrecipitation.reduce(
          (a, b) => a + b,
          0
        )

        console.log(
          'check_irrigation_valves',
          `Aimed: ${aimedPrecipitationLevel * observedDays}`,
          `Current: ${historicPrecipitationLevel}`,
          `Estimated in ${overshootDays} days: ${estimatedPrecipitationLevel}`
        )

        if (
          historicPrecipitationLevel < aimedPrecipitationLevel * observedDays &&
          estimatedPrecipitationLevel < aimedPrecipitationLevel * observedDays
        ) {
          const irrigationAmount =
            aimedPrecipitationLevel * observedDays -
            Math.max(historicPrecipitationLevel, estimatedPrecipitationLevel)
          const irrigationMillis =
            (irrigationAmount / waterVolumePerMinute) * 60 * 1000
          historicPrecipitation[(historicPrecipitation.length || 1) - 1] +=
            irrigationAmount

          json_storage(valve.name).set(
            'irrigation',
            'history',
            historicPrecipitation
          )

          json_storage(valve.name).set(
            'irrigation',
            'last-activation',
            now.format(DATETIME_FORMAT)
          )

          if (timers[valve.name]) {
            timers[valve.name].clear()
          }

          timers[valve.name] = (function (itemName, millis) {
            const func = () => {
              items.getItem(itemName).sendCommand('OFF')
              console.log(
                'check_irrigation_valves',
                `Stopped irrigation via valve ${itemName}.`
              )
            }

            items.getItem(itemName).sendCommand('ON')
            console.log(
              'check_irrigation_valves',
              `Start irrigation via valve ${itemName} for ${millis} ms...`
            )

            const timer = setTimeout(func, millis)
            return {
              clear: () => {
                func()
                clearTimeout(timer)
              }
            }
          })(valve.name, Number.parseInt(irrigationMillis))

          break
        }
      }
    }
  })

  rules.JSRule({
    name: 'check_irrigation_forecast',
    description: 'Core (JS) - Check for irrigation forecast',
    tags: ['core', 'core-irrigation'],
    triggers: [
      triggers.TimeOfDayTrigger('3:00'),
      triggers.SystemStartlevelTrigger(100)
    ],
    execute: (event) => {
      const now = time.ZonedDateTime.now()
      let precipitations =
        json_storage('gCore_Irrigation').get('irrigation', 'last-forecast') ||
        []

      const lastForecastCheck = json_storage('gCore_Irrigation').get(
        'irrigation',
        'last-forecast-check'
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

      if (!apiKey || longitude === undefined || latitude === undefined) {
        console.log(
          'check_irrigation_forecast',
          `No API Token or location coordinates set.`
        )
        return
      }

      if (
        !lastForecastCheck ||
        time.ZonedDateTime.parse(lastForecastCheck, DATETIME_FORMAT).until(
          now,
          time.ChronoUnit.DAYS
        ) > 0
      ) {
        const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&exclude=hourly,minutely,current,alerts&appid=${apiKey}`
        precipitations = JSON.parse(
          actions.HTTP.sendHttpGetRequest(url, TIMEOUT)
        ).daily.map((data) => data.rain || 0)

        json_storage('gCore_Irrigation').set(
          'irrigation',
          'last-forecast',
          precipitations
        )

        json_storage('gCore_Irrigation').set(
          'irrigation',
          'last-forecast-check',
          now.format(DATETIME_FORMAT)
        )
      }

      const valves = items.getItem('gCore_Irrigation_Valves').members
      for (let valve of valves) {
        const lastCheck = json_storage(valve.name).get(
          'irrigation',
          'last-history-update'
        )

        const observedDays = json_storage(valve.name).get(
          'irrigation',
          'observed-days'
        )

        let historicPrecipitation =
          json_storage(valve.name).get('irrigation', 'history') || []

        if (
          (!lastCheck ||
            time.ZonedDateTime.parse(lastCheck, DATETIME_FORMAT).until(
              now,
              time.ChronoUnit.DAYS
            ) > 0) &&
          precipitations.length
        ) {
          historicPrecipitation.push(precipitations[0])
          historicPrecipitation = historicPrecipitation.slice(
            -observedDays || -precipitations.length
          )

          json_storage(valve.name).set(
            'irrigation',
            'history',
            historicPrecipitation
          )

          json_storage(valve.name).set(
            'irrigation',
            'last-history-check',
            now.format(DATETIME_FORMAT)
          )
        }
      }
    }
  })
}

function scriptUnloaded() {
  // Close valves
  for (const timer in timers) {
    timers[timer].clear()
  }
}
