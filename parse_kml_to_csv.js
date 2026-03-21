const fs = require('fs')

const inputPath = 'mission_control_2.kml'
const outputPath = 'zone_polygons_2.csv'

const xml = fs.readFileSync(inputPath, 'utf8')
const tagRegex = /<\/?([A-Za-z0-9:_-]+)([^>]*)>|([^<]+)/g

const elementStack = []
const folderStack = []
let currentPlacemark = null
const rows = []

function getCurrentZone() {
  for (let i = folderStack.length - 1; i >= 0; i--) {
    const name = (folderStack[i].name || '').trim()
    if (/^Zone\s+\d+$/i.test(name)) {
      return name.replace(/\s+/g, ' ').trim()
    }
  }
  return null
}

let match
while ((match = tagRegex.exec(xml)) !== null) {
  const [, tagNameRaw, , textRaw] = match

  if (tagNameRaw) {
    const full = match[0]
    const isClose = full.startsWith('</')
    const isSelfClose = full.endsWith('/>')
    const tagName = tagNameRaw.includes(':')
      ? tagNameRaw.split(':')[1]
      : tagNameRaw

    if (!isClose) {
      elementStack.push(tagName)

      if (tagName === 'Folder') {
        folderStack.push({ name: null })
      } else if (tagName === 'Placemark') {
        currentPlacemark = { name: null, hasPolygon: false }
      } else if (tagName === 'Polygon' && currentPlacemark) {
        currentPlacemark.hasPolygon = true
      }

      if (isSelfClose) {
        elementStack.pop()
      }
    } else {
      if (tagName === 'Placemark' && currentPlacemark) {
        if (currentPlacemark.hasPolygon && currentPlacemark.name) {
          const zone = getCurrentZone()
          if (zone) {
            rows.push({
              zone,
              polygon: currentPlacemark.name.trim().replace(/\s+/g, ' '),
            })
          }
        }
        currentPlacemark = null
      } else if (tagName === 'Folder') {
        folderStack.pop()
      }

      for (let i = elementStack.length - 1; i >= 0; i--) {
        const t = elementStack.pop()
        if (t === tagName) break
      }
    }
  } else if (textRaw) {
    const text = textRaw.trim()
    if (!text) continue

    const currentTag = elementStack[elementStack.length - 1]
    const parentTag = elementStack[elementStack.length - 2]

    if (currentTag === 'name') {
      if (parentTag === 'Folder' && folderStack.length) {
        folderStack[folderStack.length - 1].name = text
      } else if (parentTag === 'Placemark' && currentPlacemark) {
        currentPlacemark.name = text
      }
    }
  }
}

const unique = new Map()
for (const row of rows) {
  unique.set(`${row.zone}||${row.polygon}`, row)
}

const data = Array.from(unique.values())

data.sort((a, b) => {
  const aZone = Number((a.zone.match(/\d+/) || ['0'])[0])
  const bZone = Number((b.zone.match(/\d+/) || ['0'])[0])
  if (aZone !== bZone) return aZone - bZone
  return a.polygon.localeCompare(b.polygon, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
})

function csvEscape(value) {
  return `"${String(value).replace(/"/g, '""')}"`
}

const csv =
  [
    'Zone,Polygon',
    ...data.map((row) => `${csvEscape(row.zone)},${csvEscape(row.polygon)}`),
  ].join('\n') + '\n'

fs.writeFileSync(outputPath, csv, 'utf8')
console.log(`Wrote ${outputPath} with ${data.length} rows.`)
