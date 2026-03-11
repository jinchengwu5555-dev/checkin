const axios = require("axios")

const COOKIE = process.env.CLOUD189_COOKIE

if (!COOKIE) {
    console.log("❌ 没有设置 CLOUD189_COOKIE")
    process.exit(1)
}

async function sign() {
    try {

        console.log("开始签到...")

        const res = await axios.get(
            "https://cloud.189.cn/api/portal/v2/sign.action",
            {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Referer": "https://cloud.189.cn/",
                    "Cookie": COOKIE
                },
                timeout: 10000
            }
        )

        let data = res.data

        if (typeof data === "string") {
            try {
                data = JSON.parse(data)
            } catch {}
        }

        console.log("返回数据:", data)

        if (data.result === 0) {
            console.log("✅ 签到成功")
        } else {
            console.log("⚠️ 可能已经签到")
        }

    } catch (err) {

        if (err.response) {
            console.log("接口错误:")
            console.log(err.response.data)
        } else {
            console.log("错误:", err.message)
        }

        process.exit(1)
    }
}

sign()
