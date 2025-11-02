const fs = require('fs')
const path = require('path')
const { 半角转全角, 中文转日区, replaceBuffer, hex2Num } = require('./utils')
const { REV_NAME_DICT, jp2RomCode } = require('./romCode2JP.js')

const tableFile = 'table.json'
const refDir = 'ear_jp'
const destDir = 'ear_cn'
genCnFiles(tableFile, refDir, destDir)

function genCnFiles(tableFile, refDir, destDir) {
    addCnHexColumn(tableFile, refDir)
    checkHexLength(tableFile)
    addCnFiles(tableFile, refDir, destDir)
}

function addCnHexColumn(tableFile, refDir) {
    const table = JSON.parse(fs.readFileSync(tableFile))
    const files = Object.keys(table)
    for (const file of files) {
        const items = table[file]
        let searchIdx = 0
        let groupIdx = -1
        const fileBuffer = fs.readFileSync(path.join(refDir, file))
        items.forEach((item, idx) => {
            let { jpHex, jpName, jp, cn } = item

            if (jp === 'error') {
                return
            }

            const cnHexArr = []
            const nameCode = REV_NAME_DICT[`【${jpName}】`] || ""
            if (nameCode) {
                cnHexArr.push(...nameCode.match(/.{2}/g))
            }
            cn = 半角转全角(cn)
            cn = 中文转日区(cn)
            const cnRomCode = jp2RomCode(cn)
            cnHexArr.push(...cnRomCode)
            const jpHexInnerArr = preprocess(jpHex.split(' '))

            // 打上日语字节开始位置，结束位置标签，以便寻找连续的日语文本
            const jpBuffer = Buffer.from(jpHex.split(' ').join(''), 'hex')
            const startIdx = fileBuffer.indexOf(jpBuffer, searchIdx)
            const endIdx = startIdx + jpBuffer.length
            searchIdx = endIdx
            item.startIdx = startIdx
            item.endIdx = endIdx
            const lastItemEndIdx = items[idx - 1]?.endIdx
            if (lastItemEndIdx && lastItemEndIdx === startIdx) {
                item.groupIdx = groupIdx
            } else {
                groupIdx += 1
                item.groupIdx = groupIdx
            }

            // 长度校正
            const lenDiff = jpHexInnerArr.length - cnHexArr.length
            if (Math.abs(lenDiff) % 2 === 1) {
                console.log(`长度差为奇数: ${lenDiff} => ${jpName} ${jp} ${cn}`)
                throw `长度差为奇数，无法删除或添加字节`
            }

            // TODO: 这是临时的增删文本，最好找到文本组，从组上调整文本长度，避免文本修改
            delete item.溢出字节数
            delete item.padLen
            if (lenDiff > 0) {
                // const addLen = lenDiff / 2
                // for (let i = 0; i < addLen; i++) {
                //     cnHexArr.push('01', '21')
                // }
                // 大部分场景可以，目前已知电影院不可以，一共 5 个 dt 文件有 ＜ＣＸ＞
                // 目前已知 C2 可以在电影院和其它地方作为无字符号使用，全场景待验证
                // 现在发现 00 也可以
                for (let i = 0; i < lenDiff; i++) {
                    cnHexArr.push('00')
                }
                item.padLen = lenDiff
            } else if (lenDiff < 0) {
                // 需要考虑 pop 的是男主名字 92 单字节的情况
                item.溢出字节数 = -lenDiff
            }

            const jpHexInner = jpHexInnerArr.join(' ')
            const cnHexInner = cnHexArr.join(' ')
            const index = jpHex.indexOf(jpHexInner)
            if (index < 0) {
                throw `找不到 ${jpHexInner} 在 ${jpHex} 中的位置`
            }
            const cnHex = jpHex.replace(jpHexInner, cnHexInner)

            // 打上固定中文字节标签的，都是自己手工调整过，无需再改
            if (!item.固定中文字节) {
                item.cnHex = cnHex
            }
        })
    }
    fs.writeFileSync(tableFile, JSON.stringify(table, null, 2))
    console.log(`已更新 ${tableFile} 的 cnHex 列`)
}

// 以 group 为单位检查，确保每个组内所有 jpHex 长度之和与 cnHex 长度之和相等
function checkHexLength(tableFile) {
    const table = JSON.parse(fs.readFileSync(tableFile))
    const files = Object.keys(table)
    let isOK = true
    for (const file of files) {
        const items = table[file]
        const groups = {}
        items.forEach(item => {
            const { groupIdx, jpHex, cnHex } = item
            if (groupIdx === undefined) {
                return
            }
            if (!groups[groupIdx]) {
                groups[groupIdx] = []
            }
            groups[groupIdx].push({ jpHex, cnHex, item })
        })
        for (const groupIdx in groups) {
            const group = groups[groupIdx]
            let jpLen = 0
            let cnLen = 0
            group.forEach(({ jpHex, cnHex }) => {
                jpLen += jpHex.split(' ').length
                cnLen += cnHex.split(' ').length
            })
            if (jpLen !== cnLen) {
                console.log(`${file} 文件的第 ${groupIdx} 组组内长度不一致: 日文长度 ${jpLen} !== ${cnLen} 中文长度`)
                isOK = false
                // throw `组内长度不一致`

                // 尝试修复这一组内的溢出文本
                // group.forEach((obj, index) => {
                //     const { item, jpHex, cnHex } = obj
                //     if (item.溢出字节数) {
                //         // 往下扫描找到第一个可以互补的元素，要求 padLen >= 溢出字节数，没有“固定中文字节”，从后往前删除 00 后，加上 “固定中文字节”，默认是一组的
                //         // 有“固定中文字节”标记的 padLen 不可信，因为修改后没有同步
                //         let fixItem = group.slice(index + 1).find(obj => (obj.item?.padLen || 0) >= item.溢出字节数 && !obj.item.固定中文字节)?.item
                //         if (!fixItem) {
                //             fixItem = group.slice(0, index).reverse().find(obj => (obj.item?.padLen || 0) >= item.溢出字节数 && !obj.item.固定中文字节)?.item
                //         }
                //         if (fixItem) {
                //             const replaceZeros = Array(item.溢出字节数).fill('00').join(' ')
                //             const replaceIdx = fixItem.cnHex.lastIndexOf(replaceZeros)
                //             if (replaceIdx < 0) {
                //                 throw `找不到 ${replaceZeros} 在 ${fixItem.cnHex} 中的位置`
                //             } else {
                //                 // console.log(item, firstFixItemAfter)
                //                 // debugger
                //                 fixItem.cnHex = fixItem.cnHex.slice(0, replaceIdx) + fixItem.cnHex.slice(replaceIdx + item["溢出字节数"] * 3)
                //                 fixItem.固定中文字节 = true
                //                 fixItem.删除字节数 = item.溢出字节数
                //             }
                //         }
                //     }
                // })
            } else {
                group.forEach(({ item }) => {
                    delete item.溢出字节数
                })
            }
        }
    }
    // 保存 fixItem 删除字节并固定的修改
    fs.writeFileSync(tableFile, JSON.stringify(table, null, 2))
    if (isOK) {
        console.log(`校验通过，所有文件组内中文字节长度日文字节与一致`)
    } else {
        console.log(`校验不通过，存在文件中文字节长度日文字节不一致`)
        throw `校验不通过，存在文件中文字节长度日文字节不一致`
    }
}

function addCnFiles(tableFile, refDir, destDir) {
    if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true })
    }
    // 拷贝 refDir 到 destDir
    fs.cpSync(refDir, destDir, { recursive: true })

    const table = JSON.parse(fs.readFileSync(tableFile))
    const files = Object.keys(table)
    for (const file of files) {
        const items = table[file]
        const destFile = path.join(destDir, file)
        let buffer = fs.readFileSync(destFile)
        for (const item of items) {
            const { jpHex, cnHex, jp } = item
            if (jp === 'error') {
                continue
            }
            const jpHexBuffer = Buffer.from(jpHex.split(' ').join(''), 'hex')
            const cnHexBuffer = Buffer.from(cnHex.split(' ').join(''), 'hex')
            buffer = replaceBuffer(buffer, jpHexBuffer, cnHexBuffer)
        }
        fs.writeFileSync(destFile, buffer)
    }
    console.log(`已根据 ${tableFile} 汉化所有文件，保存目录 ${path.resolve(destDir)}`)
}

function preprocess(hexArr) {
    let newHexArr = Array.from(hexArr)
    // 去掉 00 前缀
    newHexArr.shift();
    // 去掉 00 15 XX XX 后缀
    // while (newHexArr.slice(-1)[0] !== '00') {
    //     newHexArr.pop();
    // }
    // newHexArr.pop();
    newHexArr = newHexArr.slice(0, -4)
    return newHexArr
}
