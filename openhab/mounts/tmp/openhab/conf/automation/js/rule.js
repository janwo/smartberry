//const { rules, actions, triggers } = require('openhab')

rules.JSRule({
  name: 'Example rule',
  description: 'Example rule',
  triggers: [triggers.GenericCronTrigger('0/10 * * * * ?')],
  execute: (data) => {
    console.log('example rule')
  }
})
