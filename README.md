## 用法
修改 table.json 和 table2.json 的中文翻译，然后
```
npm run all
```
这行命令会：
1. 更新 table.json 和 table2.json 中的 cnHex 字段
2. 复制 `ear_jp` 目录为 `ear_cn` 目录，并根据 table.json 和 table2.json 将 `ear_cn` 目录下指定的日文游戏脚本改为中文脚本
3. 打包 `ear_cn` 目录下的文件为 `LOVE.EAR` 文件
4. 将 `LOVE.EAR` 文件注入 `Love Escalator_CN.hdi`

跑完没有报错，就可以打开 `Love Escalator_CN.hdi` 测试游戏了


## Note
- table2.json 是对 table.json 的补充翻译，主要内容是选项，然后是一些自动播放的特殊文本（比如主角出车祸时回忆跟别人对话的情境）
