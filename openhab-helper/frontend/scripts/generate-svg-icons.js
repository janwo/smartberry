const fs = require('fs')
const path = require('path')
const { XMLParser, XMLBuilder } = require('fast-xml-parser')
const parserOptions = {
  ignoreAttributes: false
}

const icons = [
  {
    inputDir: '../../node_modules/eva-icons/outline/svg/',
    outputFile: '../tmp/assets/svg-icons.svg',
    nameList: [
      'thermometer-outline',
      'film-outline',
      'alert-circle-outline',
      'link-2-outline',
      'chevron-down-outline',
      'umbrella-outline',
      'chevron-up-outline',
      'checkmark-outline',
      'grid-outline',
      'bulb-outline',
      'activity-outline',
      'shield-outline',
      'question-mark-circle-outline'
    ]
  }
]

function mergeSVG(svgObj, file, symbol) {
  const fileContents = fs.readFileSync(file, 'utf8')
  const newSvgObj = fromXML(fileContents)
  const symbolNode = {
    '@_id': symbol,
    '@_viewBox': newSvgObj.svg['@_viewBox'],
    g: newSvgObj.svg.g
  }
  svgObj.svg.symbol = svgObj.svg?.symbol || []
  svgObj.svg.symbol.push(symbolNode)
}

function fromXML(contents) {
  const parser = new XMLParser(parserOptions)
  return parser.parse(contents)
}

function toXML(obj) {
  const builder = new XMLBuilder(parserOptions)
  return builder.build(obj)
}

icons.forEach((set) => {
  const svg = fromXML(
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0" style="display:none;"></svg>'
  )
  set.nameList.forEach((name) => {
    mergeSVG(svg, path.resolve(__dirname, set.inputDir, name + '.svg'), name)
  })
  fs.writeFileSync(path.resolve(__dirname, set.outputFile), toXML(svg))
})
