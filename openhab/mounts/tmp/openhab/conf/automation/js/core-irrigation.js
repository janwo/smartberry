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

function irrigated_today(item) {
  const now = time.ZonedDateTime.now()
  const lastActivationCompleted = json_storage(
    typeof item == 'string' ? item : item.name
  ).get('irrigation', 'last-activation-completed')

  return (
    lastActivationCompleted &&
    time.ZonedDateTime.parse(lastActivationCompleted, DATETIME_FORMAT).until(
      now,
      time.ChronoUnit.DAYS
    ) <= 0
  )
}

function set_as_activated(item) {
  const now = time.ZonedDateTime.now()
  json_storage(typeof item == 'string' ? item : item.name).set(
    'irrigation',
    'last-activation',
    now.format(DATETIME_FORMAT)
  )
}

function set_as_completed(item) {
  item = typeof item == 'string' ? item : item.name

  const lastActivation = json_storage(item).get('irrigation', 'last-activation')
  const waterVolumePerMinute = json_storage(item).get(
    'irrigation',
    'irrigation-level-per-minute'
  )

  const now = time.ZonedDateTime.now()
  json_storage(item).set(
    'irrigation',
    'last-activation-completed',
    now.format(DATETIME_FORMAT)
  )

  if (lastActivation && waterVolumePerMinute) {
    const irrigationMillis = time.ZonedDateTime.parse(
      lastActivation,
      DATETIME_FORMAT
    ).until(now, time.ChronoUnit.MILLIS)
    const irrigationAmount =
      (irrigationMillis / 60 / 1000) * waterVolumePerMinute

    let irrigationHistory =
      json_storage(item).get('irrigation', 'history') || {}
    const today = time.LocalDate.now()
    irrigationHistory = Object.keys(irrigationHistory)
      .filter(
        (date) =>
          time.LocalDate.parse(date).until(today, time.ChronoUnit.DAYS) <= 30
      )
      .reduce((newHistory, date) => {
        newHistory[date] = irrigationHistory[date]
        return newHistory
      }, {})
    const todayKey = today.toString()
    irrigationHistory[todayKey] =
      (irrigationHistory[todayKey] || 0) + irrigationAmount
    json_storage(item).set('irrigation', 'history', irrigationHistory)
  }
}

function may_irrigate(item) {
  item = typeof item == 'string' ? item : item.name

  const observedDays = json_storage(item).get('irrigation', 'observed-days')

  const overshootDays = json_storage(item).get('irrigation', 'overshoot-days')

  const waterVolumePerMinute = json_storage(item).get(
    'irrigation',
    'irrigation-level-per-minute'
  )

  if (
    [overshootDays, observedDays, waterVolumePerMinute].some(
      (value) => value === undefined
    )
  ) {
    console.log(
      'check_irrigation_valves',
      `Some irrigation values of item ${item} are missing.`
    )
    return false
  }

  const minimalKelvin = (() => {
    const storage =
      json_storage(item).get('irrigation', 'minimal-temperature') || 'C'

    const value = Number.parseInt(storage.substring(0, storage.length - 1))
    if (Number.isNaN(value)) {
      return undefined
    }

    const unit = storage.substring(storage.length - 1).toUpperCase()
    return unit == 'C' ? value + 273.15 : () => 1.8 * (value + 273.15) + 32
  })()

  const weatherForecast =
    json_storage('gCore_Irrigation').get('irrigation', 'weather-forecast') || []

  const weatherHistory =
    json_storage('gCore_Irrigation').get('irrigation', 'weather-history') || []

  const irrigationHistory =
    json_storage(item).get('irrigation', 'history') || {}

  const evaporationFactor =
    json_storage(item).get('irrigation', 'evaporation-factor') || 1

  const series = [
    ...weatherHistory,
    ...weatherForecast.slice(0, Math.min(weatherForecast.length, 7))
  ]

  const minimalTemperatureSeriesIndex = series.findIndex(
    (s) => s.temperature.min < minimalKelvin
  )

  if (minimalTemperatureSeriesIndex >= 0) {
    console.log(
      'check_irrigation_valves',
      `Minimal temperature was missed on ${series[minimalTemperatureSeriesIndex].date}.`
    )
    return false
  }

  const pastPrecipitationLevels = weatherHistory
    .slice(Math.max(0, weatherHistory.length - observedDays))
    .reduce(
      (level, wh) =>
        level +
        wh.rain +
        (irrigationHistory[wh.date] || 0) -
        wh.eto * evaporationFactor,
      0
    )
  const futurePrecipitationLevels = weatherForecast
    .slice(0, overshootDays)
    .reduce(
      (level, wf) =>
        level +
        wf.rain +
        (irrigationHistory[wf.date] || 0) -
        wf.eto * evaporationFactor,
      0
    )

  if (
    weatherHistory.length >= observedDays &&
    pastPrecipitationLevels < 0 &&
    pastPrecipitationLevels + futurePrecipitationLevels < 0
  ) {
    const irrigationAmount = -pastPrecipitationLevels
    const irrigationMillis =
      (irrigationAmount / waterVolumePerMinute) * 60 * 1000

    add_timer(item, irrigationMillis)
    return true
  }

  return false
}

function add_timer(itemName, millis) {
  clear_timer(itemName)

  items.getItem(itemName).sendCommand('ON')
  console.log(
    'check_irrigation_valves',
    `Start irrigation via valve ${itemName} for ${millis} ms...`
  )

  timers[itemName] = setTimeout(
    (itemName) => {
      items.getItem(itemName).sendCommand('OFF')
      console.log(
        'check_irrigation_valves',
        `Stopped irrigation via valve ${itemName}.`
      )
    },
    Number.parseInt(millis),
    itemName
  )
}

function clear_timer(itemName) {
  if (timers[itemName] !== undefined) {
    clearTimeout(timers[itemName])
    delete timers[itemName]
  }
}

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
      triggers.GroupStateChangeTrigger('gCore_Irrigation_Valves')
    ],
    execute: (event) => {
      if (
        event.triggerType == 'ItemStateChangeTrigger' &&
        event.oldState == 'OFF' &&
        event.newState == 'ON'
      ) {
        set_as_activated(event.itemName)
      }

      if (
        event.triggerType == 'ItemStateChangeTrigger' &&
        event.oldState == 'ON' &&
        event.newState == 'OFF'
      ) {
        set_as_completed(event.itemName)
      }

      const valves = items.getItem('gCore_Irrigation_Valves').members
      if (valves.some((valve) => valve.state == 'ON')) {
        return
      }

      for (let valve of valves) {
        if (!irrigated_today(valve) && may_irrigate(valve)) {
          break
        }
      }
    }
  })

  const hargreavesSamani = (
    date = time.LocalDate.now(),
    tempMin,
    tempMax,
    humidity,
    latitude
  ) => {
    tempMin = Number.parseFloat(tempMin)
    tempMax = Number.parseFloat(tempMax)
    humidity = Number.parseFloat(humidity)
    latitude = Number.parseFloat(tempMax)

    /**
     * Equations taken from:
     * Shuttleworth, W. J. Evaporation. In: Handbook of hydrology, D. R. Maidment, ed., McGraw-Hill, New York, 1993.
     * Valiantzas, J. D. (2018). Modification of the Hargreaves–Samani model for estimating solar radiation from temperature and humidity data. Journal of Irrigation and Drainage Engineering, 144(1), 06017014.
     */

    const julianDate = Math.floor(
      date.atStartOfDay(time.ZoneId.SYSTEM).toEpochSecond() / 86400 + 2440587.5
    )
    const radians = latitude * (Math.PI / 180)

    // See equation 4.4.3
    const solarDeclination =
      0.4093 * Math.sin((2 * Math.PI * julianDate) / 365 - 1.405)

    // See equation 4.4.2
    const sunsetHourAngle = Math.acos(
      -Math.tan(radians) * Math.tan(solarDeclination)
    )

    // See equation 4.4.5
    const relativeEarthSunDistance =
      1 + 0.033 * Math.cos((2 * Math.PI * julianDate) / 365)

    // See equation 4.4.4
    const solarRadiation =
      15.392 *
      relativeEarthSunDistance *
      (sunsetHourAngle * Math.sin(radians) * Math.sin(solarDeclination) +
        Math.cos(radians) *
          Math.cos(solarDeclination) *
          Math.sin(sunsetHourAngle))

    // See equation 4.2.44
    const evaporation =
      0.0023 *
      solarRadiation *
      Math.sqrt(tempMax - tempMin) *
      ((tempMax + tempMin) / 2 + 17.8)

    // Apply modification to take humidity into account
    return evaporation * Math.pow(1.001 - humidity / 100, 0.2)
  }

  rules.JSRule({
    name: 'check_weather_forecast',
    description: 'Core (JS) - Check for weather forecast',
    tags: ['core', 'core-irrigation'],
    triggers: [
      triggers.TimeOfDayTrigger('3:00'),
      triggers.SystemStartlevelTrigger(100)
    ],
    execute: (event) => {
      let weatherForecast = (
        json_storage('gCore_Irrigation').get(
          'irrigation',
          'weather-forecast'
        ) || []
      ).map((f) => ({
        ...f,
        date: time.LocalDate.parse(f.date)
      }))

      let weatherHistory = (
        json_storage('gCore_Irrigation').get('irrigation', 'weather-history') ||
        []
      ).map((f) => ({
        ...f,
        date: time.LocalDate.parse(f.date)
      }))

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
          'check_weather_forecast',
          `No API Token or location coordinates set.`
        )
        return
      }

      const today = time.LocalDate.now()
      const lastWeatherForecast =
        weatherHistory[weatherHistory.length - 1]?.date
      const pastForecasts = weatherForecast.filter(
        (f) =>
          (!lastWeatherForecast || f.date.isAfter(lastWeatherForecast)) &&
          f.date.isBefore(today)
      )

      if (pastForecasts.length > 0) {
        json_storage('gCore_Irrigation').set(
          'irrigation',
          'weather-history',
          [
            ...weatherHistory.slice(
              Math.max(0, weatherHistory.length + pastForecasts.length - 7)
            ),
            ...pastForecasts
          ].map((f) => ({ ...f, date: f.date.toString() }))
        )
      }

      if (!weatherForecast[0] || weatherForecast[0].date.isBefore(today)) {
        const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&exclude=hourly,minutely,current,alerts&appid=${apiKey}&units=standard`
        weatherForecast = JSON.parse(
          actions.HTTP.sendHttpGetRequest(url, TIMEOUT)
        ).daily.map((data) => {
          const date = time.LocalDate.ofInstant(
            time.Instant.ofEpochSecond(data.dt),
            time.ZoneId.SYSTEM
          )

          return {
            date: date.toString(),
            rain: data.rain || 0,
            temperature: {
              max: data.temp.max,
              min: data.temp.min
            },
            humidity: data.humidity,
            eto: hargreavesSamani(
              date,
              data.temp.min - 273.15,
              data.temp.max - 273.15,
              data.humidity,
              latitude
            )
          }
        })

        json_storage('gCore_Irrigation').set(
          'irrigation',
          'weather-forecast',
          weatherForecast
        )
      }
    }
  })
}

function scriptUnloaded() {
  // Close valves
  for (const timer in timers) {
    clear_timer(timer)
  }
}
