const fs = require('fs')
const path = require('path')
const parser = require('fast-xml-parser')
const parserOptions = {
  ignoreAttributes: false,
  arrayMode: true
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
      'checkmark-outline',
      'grid-outline',
      'question-mark-circle-outline'
    ]
  }
]

function mergeSVG(svgObj, file, symbol) {
  const fileContents = fs.readFileSync(file, 'utf8')
  const newSvgObj = fromXML(fileContents)
  const symbolNode = {
    '@_id': symbol,
    '@_viewBox': newSvgObj.svg[0]['@_viewBox'],
    g: newSvgObj.svg[0].g
  }
  svgObj.svg[0].symbol = svgObj.svg[0]?.symbol || []
  svgObj.svg[0].symbol.push(symbolNode)
}

function fromXML(contents) {
  return parser.parse(contents, parserOptions)
}

function toXML(obj) {
  const toXML = new parser.j2xParser(parserOptions)
  return toXML.parse(obj)
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
