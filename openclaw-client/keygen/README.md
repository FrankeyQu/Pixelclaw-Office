# 许可证签发工具

**仅供发行方使用，勿泄露或提交到公开仓库。**

## 环境

- Python 3（仅需标准库，无需安装依赖）

## 用法

```bash
# 生成默认许可证（cat-pack, bulletin-board）
python generate.py

# 指定产品
python generate.py cat-pack bulletin-board

# 完整参数
python generate.py --products cat-pack,bulletin-board --type site --expiry 2026-12-31 --holder "某公司"
```

## 参数

| 参数 | 说明 | 默认 |
|------|------|------|
| --products, -p | 产品 ID，逗号分隔 | cat-pack, bulletin-board |
| --type, -t | site（企业）或 personal（个人） | site |
| --expiry, -e | 到期日 YYYY-MM-DD | 2026-12-31 |
| --holder, -H | 授权对象名称 | 空 |

## 交付

将输出的整条码（PXO- 开头）复制发送给客户，客户在应用中粘贴即可激活。
