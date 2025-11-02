const fs = require('fs')
const path = require('path')
const { romCode2JP, jp2RomCode } = require('./romCode2JP')
const { 中文转日区, replaceBuffer } = require('./utils')

const refDir = 'ear_jp'
const destDir = 'ear_cn'
const filename = 'startup.eqa' // 专门存储角色名字的游戏文件
translateNames(refDir, destDir, filename)

function translateNames(refDir, destDir, filename) {
    const refFile = path.join(refDir, filename)
    const destFile = path.join(destDir, filename)

    let buffer = fs.readFileSync(refFile)
    const nameDict = {
        // "たかし": "",  主角名字，不用翻译，主角姓氏也不用
        "脇谷": "胁谷",
        "理恵": "理惠",
        "のり子": "纪子",
        "ひな子": "雏子",
        "真由美": "真由美",
        "美紀": "美纪",
        "ともみ": "友美",
        "貴久美": "贵久美",
        "美奈代": "美奈代",
        "まりな": "麻里奈",
        "あゆか": "步香",
        "美里": "美里",
        "榊原": "榊原",
        "和正": "和正",
        "田村": "田村",
        "中野": "中野",
        "千葉": "千叶",
        "藤田": "藤田",
        "松波": "松波",
        "市川": "市川",
        "高市": "高市",
        "由美": "由美",
        "薫子": "薰子",
        "神谷": "神谷",
        "森": "森",
        "高岡": "高冈",
        "岡": "冈",
        "社長": "社长",
        "川久保": "川久保",
        "さおり": "纱织",
        "華奈": "华奈",
        "みずき": "美月",
        "洋子": "洋子",
        "男": "男",
        "女": "女",
        "男性": "男性",
        "女性": "女性",
        "男の子": "男孩子",
        "女の子": "女孩子",
        "女の子１": "女孩子１",
        "女の子２": "女孩子２",
        "女の子３": "女孩子３",
    }
    const REG = /\x83\x01\x5A[\s\S]{2,100}?\x01\x5B\x82/g
    const matches = buffer.toString('latin1').match(REG)
    let totDiff = 0
    matches.forEach((match, index) => {
        const jpBuffer = Buffer.from(match, 'latin1')
        const matchHex = jpBuffer.toString('hex').toUpperCase().match(/../g)
        const romCode = matchHex.slice(3, -3)
        const jp = romCode2JP(romCode)
        if (nameDict[jp]) {
            let cn = nameDict[jp]
            cn = 中文转日区(cn)
            const cnCode = jp2RomCode(cn)
            const cnHex = '83,01,5A,' + cnCode + ',01,5B,82'
            let cnBuffer = Buffer.from(cnHex.split(',').join(''), 'hex')
            const lenDiff = jpBuffer.length - cnBuffer.length
            totDiff += lenDiff
            // if (lenDiff < 0) {
            //     throw `中文人名不应长于日文`
            // } else if (lenDiff > 0) {
            //     const padBuffer = Buffer.alloc(lenDiff, 0x00)
            //     cnBuffer = Buffer.concat([cnBuffer.slice(0, -3), padBuffer, cnBuffer.slice(-3)])
            // }
            // if (jpBuffer.length !== cnBuffer.length) {
            //     debugger
            // }

            // 在最后一个替换的时候，给中文 buffer 补 00
            if (index === matches.length - 1) {
                const padBuffer = Buffer.alloc(totDiff, 0x00)
                cnBuffer = Buffer.concat([cnBuffer, padBuffer])
            }

            buffer = replaceBuffer(buffer, jpBuffer, cnBuffer)
        }
    })

    fs.writeFileSync(destFile, buffer)
    console.log(`已翻译人名文件，保存为 ${path.resolve(destFile)}`)
}