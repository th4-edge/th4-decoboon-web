#!/bin/bash
BASE="http://127.0.0.1:8090/api"
TOK=$(curl -s -X POST "$BASE/auth/session/password-login" -H 'Content-Type: application/json' -d '{"phone":"19900000006","password":"Zhuang2026Test"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
post(){ curl -s -X POST "$BASE/$1" -H "token: $TOK" -H 'Content-Type: application/json' -d "$2"; }
info(){ post "quote/designer/info" "{\"quoteId\":\"$QID\"}"; }
tokof(){ python3 -c "import sys,json;print(json.load(sys.stdin)['data'].get('revision') or '')"; }

echo "=== ① 新建独立小型 Draft 报价（设计=$DESIGN）==="
NEW=$(post "quote/save" "{\"designId\":\"$DESIGN\",\"discount\":1}")
QID=$(echo "$NEW" | python3 -c "import sys,json;q=json.load(sys.stdin)['data'];print(q['quoteId'])")
echo "  quoteId=$QID  编号=$(echo "$NEW" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['no'])")"
T0=$(info | tokof)
ROWS=$(info | python3 -c "import sys,json;print(len(json.load(sys.stdin)['data']['items']))")
echo "  行数=$ROWS  初始令牌 T0=${T0:0:20}…"
ITEM=$(info | python3 -c "import sys,json;print([i for i in json.load(sys.stdin)['data']['items'] if i['materialPrice']>0][0]['itemId'])")
BEFORE=$(info | python3 -c "import sys,json;q=json.load(sys.stdin)['data'];i=[x for x in q['items'] if x['itemId']=='$ITEM'][0];print('%s %s %s' % (i['quantity'],i['materialPrice'],q['amount']))")
echo "  目标行初始 qty/mat/总额 = $BEFORE"
echo "QID=$QID" > /tmp/p1b_qid.txt

echo "=== ② 会话 A：用 T0 保存 → 期望成功 + 新令牌 ==="
RA=$(post "quote/lines/save" "{\"quoteId\":\"$QID\",\"revisionToken\":\"$T0\",\"items\":[{\"itemId\":\"$ITEM\",\"materialPrice\":956,\"materialPriceProvided\":true}]}")
echo "$RA" | python3 -c "import sys,json;d=json.load(sys.stdin);print('  success=%s 新令牌=%s…' % (d.get('success'), str((d.get('data') or {}).get('revision'))[:20]))"

echo "=== ③ 会话 B：仍用旧 T0 保存 → 期望 409 ==="
RB=$(post "quote/lines/save" "{\"quoteId\":\"$QID\",\"revisionToken\":\"$T0\",\"items\":[{\"itemId\":\"$ITEM\",\"manualPrice\":99,\"manualPriceProvided\":true}]}")
echo "$RB" | python3 -c "import sys,json;d=json.load(sys.stdin);print('  success=%s code=%s msg=%s' % (d.get('success'),(d.get('errorCode') or {}).get('code'),(d.get('errorCode') or {}).get('message')))"

echo "=== ④ App 单行写入（不带令牌）后 Web 用旧令牌 → 期望 409 ==="
T1=$(info | tokof)
post "quote/line/save" "{\"quoteId\":\"$QID\",\"itemId\":\"$ITEM\",\"catalogItemId\":\"$CAT\",\"quantity\":12}" >/dev/null
RC=$(post "quote/lines/save" "{\"quoteId\":\"$QID\",\"revisionToken\":\"$T1\",\"items\":[{\"itemId\":\"$ITEM\",\"materialPrice\":957,\"materialPriceProvided\":true}]}")
echo "$RC" | python3 -c "import sys,json;d=json.load(sys.stdin);print('  success=%s code=%s' % (d.get('success'),(d.get('errorCode') or {}).get('code')))"

echo "=== ⑤ 用当前令牌幂等重试 → 期望成功 ==="
T2=$(info | tokof)
RD=$(post "quote/lines/save" "{\"quoteId\":\"$QID\",\"revisionToken\":\"$T2\",\"items\":[{\"itemId\":\"$ITEM\",\"materialPrice\":956,\"materialPriceProvided\":true}]}")
echo "$RD" | python3 -c "import sys,json;d=json.load(sys.stdin);print('  success=%s' % d.get('success'))"
