from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import os
import time
import atexit

app = Flask(__name__)
CORS(app) # Enable CORS for React frontend

new_msg_time = 10
country_code = "91"
driver = None

def cleanup():
    global driver
    if driver is not None:
        print("\n[*] Shutting down Chrome webdriver...")
        try:
            driver.quit()
        except Exception:
            pass

atexit.register(cleanup)

def get_driver():
    global driver
    # Check if driver is already running and responsive
    if driver is not None:
        try:
            # Try to get current URL to verify if browser is open and connected
            driver.current_url
            return driver
        except Exception:
            print("Browser was closed or disconnected. Re-opening Chrome...")
            try:
                driver.quit()
            except Exception:
                pass
            driver = None

    # Initialize a new Chrome webdriver with persistent session profile
    print("Starting WhatsApp Selenium webdriver...")
    options = Options()
    
    # Store chrome data inside the main.py directory so login persists
    profile_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "whatsapp_chrome_session")
    
    # Pre-clean lock files at root level to release stale locks
    if os.path.exists(profile_path):
        try:
            for root, dirs, files in os.walk(profile_path):
                for file in files:
                    if "lock" in file.lower():
                        try:
                            os.remove(os.path.join(root, file))
                            print(f"Pre-cleaned stale lock file: {file}")
                        except Exception:
                            pass
                break # Only root level files
        except Exception:
            pass

    options.add_argument(f"user-data-dir={profile_path}")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    
    try:
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    except Exception as e:
        err_msg = str(e)
        if "DevToolsActivePort" in err_msg or "crashed" in err_msg or "session not created" in err_msg:
            print("\n[!] Chrome failed to start with current profile. Initializing self-healing fallback...")
            
            # Fallback 1: Rename the locked/corrupted profile directory so Chrome starts fresh
            backup_path = profile_path + f"_backup_{int(time.time())}"
            try:
                if os.path.exists(profile_path):
                    os.rename(profile_path, backup_path)
                    print(f"[*] Moved locked/corrupted profile to backup: {backup_path}")
            except Exception as rename_err:
                print(f"[!] Could not rename profile folder: {rename_err}")
                
            # Retry starting Chrome with a clean profile directory path
            try:
                driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
                print("[*] Started Chrome successfully with a fresh profile. Please scan the QR code.")
            except Exception as retry_err:
                print(f"[!] Clean profile initialization failed: {retry_err}")
                
                # Fallback 2: Start Chrome without user-data-dir (incognito/guest style)
                print("[*] Attempting Fallback 2: Launching Chrome without custom profile directory...")
                clean_options = Options()
                clean_options.add_argument("--no-sandbox")
                clean_options.add_argument("--disable-dev-shm-usage")
                clean_options.add_argument("--disable-gpu")
                clean_options.add_argument("--disable-extensions")
                try:
                    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=clean_options)
                    print("[*] Chrome launched successfully in guest mode.")
                except Exception as final_err:
                    explanation = f"Critical Chrome start error: {str(final_err)}. Please verify Chrome is installed."
                    print(f"\n[!] FATAL: {explanation}\n")
                    raise Exception(explanation)
        else:
            raise e
    
    # Load WhatsApp Web initially
    print("Opening WhatsApp Web. Please scan the QR code to log in (if not already logged in).")
    driver.get('https://web.whatsapp.com')
    return driver

# Chrome will be initialized dynamically on the first message sending request instead of startup.

@app.route('/api/health', methods=['GET', 'POST'])
def health_check():
    return jsonify({"status": "healthy"}), 200

@app.route('/api/send', methods=['POST'])
def send_whatsapp_message():
    saved_files = []
    try:
        # Check content type for multipart/form-data
        if request.content_type and 'multipart/form-data' in request.content_type:
            phone = request.form.get('phone', '').strip()
            message = request.form.get('message', '').strip()
            attachments = request.files.getlist('attachments')
        else:
            data = request.json or {}
            phone = data.get('phone', '').strip()
            message = data.get('message', '').strip()
            attachments = []
        
        if not phone:
            return jsonify({"status": "Error", "message": "Phone number is required!"}), 400
            
        # Clean phone number: remove '+', spaces, brackets, hyphens
        clean_phone = "".join(c for c in phone if c.isdigit())
        
        if len(clean_phone) < 7:
            return jsonify({"status": "Error", "message": f"Phone number is too short or invalid: {phone}"}), 400
        
        # Get active driver (re-opens if user closed it) - now called ONLY for valid phone numbers
        active_driver = get_driver()
        
        # Save attachments to temp folder
        temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_attachments")
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
            
        for file in attachments:
            if file.filename:
                filename = secure_filename(file.filename)
                # Add timestamp to avoid collisions
                filename = f"{int(time.time())}_{filename}"
                file_path = os.path.join(temp_dir, filename)
                file.save(file_path)
                saved_files.append(file_path)
        
        # If it's a 10 digit number, assume Indian country code (91)
        if len(clean_phone) == 10:
            clean_phone = country_code + clean_phone
            
        print(f"Sending message to: {clean_phone}")
        
        # Dismiss any unexpected browser alerts (like beforeunload) before navigating
        try:
            alert = active_driver.switch_to.alert
            alert.accept()
            print("Dismissed active browser alert.")
        except Exception:
            pass
            
        link = f'https://web.whatsapp.com/send/?phone={clean_phone}'
        active_driver.get(link)
        
        # Wait for either the chat text box OR the invalid number popup to appear
        target_xpath = (
            '//footer//div[@contenteditable="true" and @role="textbox"] | '
            '//div[@contenteditable="true" and @data-tab="10"] | '
            '//div[contains(text(), "Phone number shared via url is invalid")] | '
            '//div[contains(text(), "Phone number shared via URL is invalid")] | '
            '//div[contains(text(), "invalid")]'
        )
        
        try:
            element = WebDriverWait(active_driver, 25).until(
                EC.presence_of_element_located((By.XPATH, target_xpath))
            )
        except Exception:
            return jsonify({"status": "Error", "message": "Chat screen failed to load (timeout)!"}), 500
            
        # Check if the resolved element is the invalid number popup
        element_text = element.text.lower()
        if "invalid" in element_text or "phone number" in element_text:
            print(f"Invalid phone number detected for: {phone}")
            try:
                ok_btn = active_driver.find_element(By.XPATH, '//div[@role="button" or @type="button" or self::button][contains(translate(., "ok", "OK"), "OK") or contains(translate(., "close", "CLOSE"), "CLOSE")]')
                ok_btn.click()
            except Exception as btn_err:
                print(f"Could not click popup OK button: {btn_err}")
            return jsonify({"status": "Error", "message": "Phone number is not registered on WhatsApp!"}), 400
        
        # If there is message text, send it
        if message:
            actions = ActionChains(active_driver)
            for line in message.split('\n'):
                actions.send_keys(line)
                # SHIFT + ENTER for line break
                actions.key_down(Keys.SHIFT).send_keys(Keys.ENTER).key_up(Keys.SHIFT)
            actions.send_keys(Keys.ENTER)
            actions.perform()
            time.sleep(2)
            
        # Send attachments if any
        for file_path in saved_files:
            if os.path.exists(file_path):
                print(f"Sending attachment: {file_path}")
                ext = os.path.splitext(file_path)[1].lower()
                is_media = ext in ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.3gp', '.webp']
                
                file_input = None
                if is_media:
                    try:
                        file_input = WebDriverWait(active_driver, 8).until(
                            EC.presence_of_element_located((By.XPATH, '//input[@accept="image/*,video/mp4,video/3gpp,video/quicktime"]'))
                        )
                    except Exception:
                        pass
                
                if file_input is None:
                    # Fallback to document input
                    file_input = WebDriverWait(active_driver, 8).until(
                        EC.presence_of_element_located((By.XPATH, '//input[@accept="*" or @type="file"]'))
                    )
                
                # Send the absolute file path
                file_input.send_keys(os.path.abspath(file_path))
                
                # Wait for the send button to appear on the attachment preview screen
                send_btn = WebDriverWait(active_driver, 15).until(
                    EC.element_to_be_clickable((By.XPATH, '//span[@data-icon="send"] | //div[@aria-label="Send"] | //span[@data-testid="send"] | //button[@type="submit"]'))
                )
                send_btn.click()
                
                # Wait for upload to complete
                time.sleep(3)
        
        return jsonify({"status": "Success", "message": f"Successfully sent to {phone}!"}), 200
        
    except Exception as e:
        print(f"Error sending message: {str(e)}")
        return jsonify({"status": "Error", "message": str(e)}), 500
        
    finally:
        # Clean up temp files
        for file_path in saved_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                print(f"Failed to delete temp file {file_path}: {e}")

if __name__ == '__main__':
    # Run the server on port 5000
    app.run(host='127.0.0.1', port=5000, debug=False)
