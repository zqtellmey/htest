import { launch } from 'cloakbrowser';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

// 发送截图到 Telegram 的辅助函数
async function sendTelegramPhoto(token, chatId, photoPath, caption) {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption);
        form.append('photo', fs.createReadStream(photoPath));

        const response = await axios.post(url, form, {
            headers: form.getHeaders()
        });
        
        if (response.data.ok) {
            console.log(`✅ 截图 [${caption.slice(0, 10)}...] 已成功发送至 Telegram。`);
        } else {
            console.log(`❌ Telegram 发送失败: ${JSON.stringify(response.data)}`);
        }
    } catch (error) {
        console.error(`❌ 发送 Telegram 消息时发生错误: ${error.message}`);
    }
}

async function main() {
    // 从环境变量 (GitHub Secrets) 读取配置
    const renewUrl = process.env.RENEW_URL;
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;

    if (!renewUrl) {
        console.error("❌ 未找到 RENEW_URL 环境变量，请检查 GitHub Secrets 设置。");
        return;
    }

    console.log("🚀 启动 CloakBrowser 隐身浏览器...");
    const browser = await launch({ headless: true });
    const page = await browser.newPage();
    
    // 设置分辨率
    await page.setViewportSize({ width: 1920, height: 1080 });

    // ================= 去广告逻辑 (网络请求拦截) =================
    console.log("🛡️ 正在配置去广告拦截规则...");
    const adDomains = [
        'googlesyndication.com',
        'doubleclick.net',
        'googleadservices.com',
        'popads.net',
        'propellerads.com',
        'monetag.com',
        'a-ads.com',
        'mellowads.com'
    ];
    
    await page.route('**/*', route => {
        const url = route.request().url();
        if (adDomains.some(domain => url.includes(domain))) {
            route.abort();
        } else {
            route.continue();
        }
    });

    try {
        console.log(`🌐 正在访问网址: ${renewUrl}`);
        
        // 【新增】：由于 goto 可能会直接崩溃，我们发起导航，并迅速在刚加载时截一张图
        // 这里不使用 await 阻塞，允许页面一边加载一边截图
        page.goto(renewUrl, { waitUntil: 'networkidle' }).catch(err => {
            // 捕获页面导航本身的错误（比如 CONNECTION_RESET）
            console.error(`⚠️ 页面导航引发异常: ${err.message}`);
        });

        // 访问后等待 1.5 秒（此时可能正在连接或刚出错误页），立刻截下初始图
        await page.waitForTimeout(1500);
        const initScreenshot = "init_page.png";
        await page.screenshot({ path: initScreenshot, fullPage: true });
        console.log(`📸 已保存刚打开网页时的初始截图: ${initScreenshot}`);
        
        if (tgToken && tgChatId) {
            await sendTelegramPhoto(tgToken, tgChatId, initScreenshot, "📸 [初始状态] 刚打开网页时的截图，用于排查连接重置问题。");
        }

        // 继续等待至总计 3 秒，让可能成功的页面稳定下来
        await page.waitForTimeout(1500);

        // ================= 去广告逻辑 (CSS 样式隐藏) =================
        try {
            console.log("🧹 正在清理页面上可能残留的广告元素...");
            await page.addStyleTag({ content: `
                ins.adsbygoogle, 
                div[id^="google_ads"], 
                div[class*="ad-container"], 
                .adsbygoogle { 
                    display: none !important; 
                    height: 0 !important; 
                    width: 0 !important; 
                    pointer-events: none !important;
                }
            `});
            console.log("✅ 页面广告元素已隐藏。");
        } catch (e) {
            console.log(`⚠️ 隐藏广告元素时出错 (可忽略): ${e.message}`);
        }

        // 1. 检测并处理欧洲隐私同意框
        try {
            console.log("🔍 检测是否弹出欧洲隐私同意框...");
            const consentBtn = await page.$("button.fc-button.fc-cta-consent.fc-primary-button");
            if (consentBtn) {
                const isVisible = await consentBtn.isVisible();
                if (isVisible) {
                    await consentBtn.click();
                    console.log("✅ 已点击同意隐私政策。");
                    await page.waitForTimeout(2000);
                }
            } else {
                console.log("ℹ️ 未检测到隐私同意框，继续下一步。");
            }
        } catch (e) {
            console.log(`⚠️ 处理隐私同意框时跳过: ${e.message}`);
        }

        // 2. 点击第一个 Renew 按钮
        try {
            console.log("👆 准备点击第一个 Renew 按钮...");
            const renewBtn1 = await page.waitForSelector('xpath=//*[@id="renew"]/div[2]/center/div/button', { timeout: 10000 });
            await renewBtn1.click();
            console.log("✅ 已点击第一个 Renew 按钮。");
            await page.waitForTimeout(4000); 
        } catch (e) {
            console.error(`❌ 点击第一个 Renew 按钮失败: ${e.message}`);
        }

        // 3. 谷歌人机验证打勾操作 (精准定位指定的 iframe)
        console.log("🤖 开始处理谷歌人机验证...");
        try {
            console.log("🔍 正在精准查找可见的 reCAPTCHA iframe...");
            const iframeElement = await page.waitForSelector('xpath=//*[@id="recaptchax"]/div/div/iframe', { timeout: 15000 });
            const frame = await iframeElement.contentFrame();
            
            if (frame) {
                console.log("✅ 成功进入 iframe，准备定位打勾框...");
                const recaptchaCheckbox = await frame.waitForSelector('xpath=//*[@id="recaptcha-anchor"]/div[1]', { timeout: 15000 });
                await recaptchaCheckbox.click();
                console.log("✅ 已点击人机验证框，等待验证通过...");
                await page.waitForTimeout(8000); 
            } else {
                console.error("❌ 找到了 iframe 元素，但无法获取其内容框架 (contentFrame)。");
            }
        } catch (e) {
            console.error(`❌ 查找或点击人机验证框失败: ${e.message}`);
        }

        // 4. 点击悬浮框中的第二个 Renew 按钮
        try {
            console.log("👆 准备点击第二个 Renew 按钮...");
            const renewBtn2 = await page.waitForSelector('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]', { timeout: 10000 });
            await renewBtn2.click();
            console.log("✅ 已点击悬浮框内的 Renew 按钮。");
            
            await page.waitForTimeout(10000); 
        } catch (e) {
            console.error(`❌ 点击第二个 Renew 按钮失败: ${e.message}`);
        }

    } catch (e) {
        console.error(`❌ 运行过程中发生未捕获的错误: ${e.message}`);
        
        // 【新增】：如果中途发生严重未捕获异常（如报错中断），立刻再截一张崩溃图发给 TG
        try {
            const errorScreenshot = "error_state.png";
            await page.screenshot({ path: errorScreenshot, fullPage: true });
            if (tgToken && tgChatId) {
                await sendTelegramPhoto(tgToken, tgChatId, errorScreenshot, `❌ [运行崩溃] 脚本异常中断。错误原因: ${e.message}`);
            }
        } catch (screenshotErr) {
            console.error(`⚠️ 尝试截取错误状态图时失败: ${screenshotErr.message}`);
        }
    } finally {
        // 最终状态截图
        const screenshotPath = "renew_result.png";
        try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 已保存最终结果截图: ${screenshotPath}`);

            if (tgToken && tgChatId) {
                await sendTelegramPhoto(tgToken, tgChatId, screenshotPath, "🔄 Server Renew 自动化脚本周期运行完毕。");
            }
        } catch (finalErr) {
            console.error(`⚠️ 最终截图输出失败: ${finalErr.message}`);
        }

        // 退出浏览器
        await browser.close();
        console.log("🛑 浏览器已关闭。任务结束。");
    }
}

main();
