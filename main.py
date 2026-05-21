import os
import time
import requests
from cloakbrowser import launch

def send_telegram_photo(token, chat_id, photo_path, caption):
    """将运行结果的截图发送到 Telegram"""
    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    try:
        with open(photo_path, 'rb') as f:
            files = {'photo': f}
            data = {'chat_id': chat_id, 'caption': caption}
            response = requests.post(url, files=files, data=data)
            if response.status_code == 200:
                print("✅ 截图已成功发送至 Telegram。")
            else:
                print(f"❌ Telegram 发送失败: {response.text}")
    except Exception as e:
        print(f"❌ 发送 Telegram 消息时发生错误: {e}")

def main():
    # 从 GitHub Actions Secrets 中读取配置
    renew_url = os.environ.get("RENEW_URL")
    tg_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    tg_chat_id = os.environ.get("TELEGRAM_CHAT_ID")

    if not renew_url:
        print("❌ 未找到 RENEW_URL 环境变量，请检查 GitHub Secrets 设置。")
        return

    print("🚀 启动 CloakBrowser 隐身浏览器...")
    browser = launch(headless=True)
    page = browser.new_page()
    
    page.set_viewport_size({"width": 1920, "height": 1080})

    try:
        print(f"🌐 正在访问网址: {renew_url}")
        page.goto(renew_url)
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # 1. 检测并处理欧洲隐私同意框
        try:
            print("🔍 检测是否弹出欧洲隐私同意框...")
            consent_btn = page.query_selector("button.fc-button.fc-cta-consent.fc-primary-button")
            if consent_btn and consent_btn.is_visible():
                consent_btn.click()
                print("✅ 已点击同意隐私政策。")
                time.sleep(2)
            else:
                print("ℹ️ 未检测到隐私同意框，继续下一步。")
        except Exception as e:
            print(f"⚠️ 处理隐私同意框时跳过: {e}")

        # 2. 点击第一个 Renew 按钮
        try:
            print("👆 准备点击第一个 Renew 按钮...")
            renew_btn_1 = page.wait_for_selector('xpath=//*[@id="renew"]/div[2]/center/div/button', timeout=10000)
            renew_btn_1.click()
            print("✅ 已点击第一个 Renew 按钮。")
            time.sleep(3)
        except Exception as e:
            print(f"❌ 点击第一个 Renew 按钮失败: {e}")

        # 3. 谷歌人机验证打勾操作 (使用提供的 XPath 定位)
        print("🤖 开始处理谷歌人机验证...")
        try:
            # 由于 reCAPTCHA 通常嵌套在 iframe 中，如果是这种情况，cloakbrowser/playwright 可能需要通过 frame 定位
            # 但首先尝试直接使用你提供的 xpath 定位器：
            recaptcha_checkbox = page.wait_for_selector('xpath=//*[@id="recaptcha-anchor"]/div[1]', timeout=15000)
            recaptcha_checkbox.click()
            print("✅ 已点击人机验证框，等待验证通过...")
            time.sleep(6) # 给予验证码转圈和打勾充足的时间
        except Exception as e:
            print(f"❌ 查找或点击人机验证框失败，如果它在 iframe 内可能需要额外处理: {e}")

        # 4. 点击悬浮框中的第二个 Renew 按钮
        try:
            print("👆 准备点击第二个 Renew 按钮...")
            renew_btn_2 = page.wait_for_selector('xpath=//*[@id="rm-body"]/div[6]/div/div[6]/button[1]', timeout=10000)
            renew_btn_2.click()
            print("✅ 已点击悬浮框内的 Renew 按钮。")
            
            time.sleep(10)
        except Exception as e:
            print(f"❌ 点击第二个 Renew 按钮失败: {e}")

    except Exception as e:
        print(f"❌ 运行过程中发生未捕获的错误: {e}")

    finally:
        screenshot_path = "renew_result.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"📸 已保存最终结果截图: {screenshot_path}")

        if tg_token and tg_chat_id:
            send_telegram_photo(tg_token, tg_chat_id, screenshot_path, caption="🔄 Server Renew 自动化脚本执行完毕，请查看最终状态。")
        else:
            print("⚠️ 未配置 Telegram Token 或 Chat ID，跳过消息发送。")

        browser.close()
        print("🛑 浏览器已关闭。任务结束。")

if __name__ == "__main__":
    main()
