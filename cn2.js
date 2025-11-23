const fs = require('fs')
const path = require('path')
const { 半角转全角, 中文转日区, hex2Num } = require('./utils')
const { romCode2JP, jp2RomCode } = require('./romCode2JP')

// table2.json 主要包含了 table.json 未提取的选项文本，以及部分例如主角回想场景的自动播放文本
const tableFile = 'table2.json'
const destDir = 'ear_cn'
addCnHexColumn(tableFile)
extraTranslate(tableFile, destDir)

function addCnHexColumn(tableFile) {
    const table = JSON.parse(fs.readFileSync(tableFile))

    // 如果有多个句子，这里需要补充人名
    const nameDict = {
        '【脇谷】': { cnName: '【胁谷】', byte: '96' },
        '【真由美】': { cnName: '【真由美】', byte: '9A' },
        '【理恵】': { cnName: '【理惠】', byte: '97' }
    }

    const files = Object.keys(table)
    for (const file of files) {
        const changes = table[file]
        for (const change of changes) {
            let { jpHex, cnHex, jp, cn, isFirstOption, 保留前2字节, 保留前4字节 } = change

            // 只有 jp 为 "" 的情况才需要解析 jp
            if (!jp) {
                jp = romCode2JP(jpHex.split(' '))
                console.log(jp)
                change.jp = jp
            }

            if (cn) {
                cn = 半角转全角(cn)
                cn = 中文转日区(cn)
                let cnArr = jp2RomCode(cn)

                // 处理人名单字节替换问题
                const jpNames = Object.keys(nameDict)
                const jpName = jpNames.find(item => jp.startsWith(item))
                if (jpName) {
                    const { cnName, byte } = nameDict[jpName]
                    cnArr.splice(0, cnName.length * 2, byte)
                }

                // 然后处理保留2字节或前4字节的问题
                if (保留前2字节 !== undefined) {
                    const bytes = jpHex.split(' ').slice(0, 2)
                    cnArr = bytes.concat(cnArr)
                } else if (保留前4字节 !== undefined) {
                    const bytes = jpHex.split(' ').slice(0, 4)
                    cnArr = bytes.concat(cnArr)
                }

                const jpArr = jpHex.split(' ')
                const lenDiff = jpArr.length - cnArr.length
                if (lenDiff < 0) {
                    throw `翻译的中文长度不应该大于日文: ${cn}`
                } else {
                    if (isFirstOption) {
                        const count = Math.floor(lenDiff / 2)
                        const left = lenDiff % 2
                        for (let i = 0; i < count; i++) {
                            cnArr.push('01', '21')
                        }
                        if (left) {
                            cnArr.push('00')
                        }
                    } else {
                        for (let i = 0; i < lenDiff; i++) {
                            cnArr.push('00')
                        }
                    }
                }
                cnHex = cnArr.join(' ').toUpperCase()
                if (cnHex.length !== jpHex.length) {
                    throw `中文 hex 和日文 hex 长度不同`
                }
                change.cnHex = cnHex

                // isFirstOption 为 true 时，检查 cnHex 中不应该有 00
                if (isFirstOption) {
                    if (cnHex.includes('00')) {
                        throw `作为第一个选项，不应出现 00 => ${cn}`
                    }
                }
            }
        }
        table[file] = table[file].sort((a, b) => hex2Num(a.addr) - hex2Num(b.addr))
        table[file].forEach(change => change.jpHex = change.jpHex.toUpperCase())
        table[file].forEach(change => change.cnHex = change.cnHex.toUpperCase())
    }
    fs.writeFileSync(tableFile, JSON.stringify(table, null, 2))
    console.log(`已更新 ${tableFile} 的 cnHex 列`)
}


function extraTranslate(tableFile, destDir) {
    const table2 = JSON.parse(fs.readFileSync(tableFile))
    const files = Object.keys(table2)
    files.forEach(file => {
        const destFile = path.join(destDir, file)
        let buffer = fs.readFileSync(destFile)
        const changes = table2[file]
        for (const change of changes) {
            const { addr, jpHex, cnHex } = change

            if (!cnHex) {
                continue // 如果 cnHex 留空，表示不修改
            }

            if (jpHex.length !== cnHex.length) {
                throw `日文字节与中文字节长度不一致，file = ${file}, addr = ${addr}`
            }
            const cnBuffer = Buffer.from(cnHex.replaceAll(' ', ''), 'hex')
            cnBuffer.copy(buffer, hex2Num(addr))
        }
        fs.writeFileSync(destFile, buffer)
    })
    console.log(`已根据 ${tableFile} 汉化所有文件，保存目录 ${path.resolve(destDir)}`)
}