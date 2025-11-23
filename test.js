const fs = require('fs')

const tableFile = 'table.json'
refreshTable(tableFile)

function refreshTable(tableFile) {
    const table = JSON.parse(fs.readFileSync(tableFile))
    const files = Object.keys(table)
    files.forEach(file => {
        const items = table[file]
        items.forEach(item => {
            if (item.删除字节数) {
                item.minusLen = item.删除字节数
                delete item.删除字节数
            }
        })
    })
    fs.writeFileSync(tableFile, JSON.stringify(table, null, 2))
}