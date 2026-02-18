<img width="100%" alt="LBM Mascot and Logo" src="https://github.com/user-attachments/assets/899a6c7d-66b2-407e-96c9-3cc90ac9138b" />

**LBM (Leaflet Blog Manager)** is a little system that allows you to run a (somewhat) dynamic micro-blog (like Twitter, or a lil’ diary) on static hosting sites like [**Neocities**](https://neocities.org) without needing to know how to code.

<img width="1470" height="1291" alt="Screenshot of LBM" src="https://github.com/user-attachments/assets/93fa3211-d8a0-4f36-8024-e93b86f43892" />


## **How it Works**

Unlike normal static sites where you have to edit code to add posts, LBM is self-editing.
1. You log into your site's dashboard (which is built right into the page).
2. You then make your post, uploading images (or, if you [Upgrade to Supporter](https://neocities.org/supporter), upload videos).
3. The system bundles your data into a system.js file and uses a special bridge to upload it back to your Neocities site automatically.
4. Your site updates instantly for everyone!

# Setup Guide
This assumes you have **zero** coding experience, but that you have signed up to Neocities. Follow these steps exactly, and you should have your site running in about 5 minutes.

### **Step 1: Get your Key**
Since LBM needs to update your site files for you, it needs permission.

1. Log into [**Neocities**](https://neocities.org/).
2. Go to your **Dashboard**.
3. Click the **"API"** tab (or simply goto `https://neocities.org/settings/[YOUR-SITE-NAME]#api_key`).
4. Click **"Generate API Key"**.
5. Copy this key. You will need it in the next step.

### **Step 2: Configurate your System**

Now it's time to configure your site before uploading it.

1. Download the LBM files (`index.html`, `logic.js` and `style.css`) to a folder on your computer.
2. Go back to your **Neocities Dashboard**
3. Drag and drop `index.html`, `logic.js` and `style.css` to upload them
4. Click your site link (e.g., `yoursite.neocities.org`) and you will see the **"SYSTEM BOOT // INITIAL SETUP"** screen.

Fill out the form on the screen:

1. **Admin Password**: Create a password. You will use this to log into your site later.
2. **Neocities API Key**: Paste the key you copied in Step 1.
3. **Branding**: Set your Site Name, Tagline, and Copyright.
4. **Theme**: Pick whatever colors you want! You can see a live preview of your choices as you change them.

### Generate the System File

1. When you are happy, click **"GENERATE `system.js`"**.
2. Your browser will download the generated `system.js` file.
3. Drag and drop this into your Neocities Dashboard to be alongside your `index.html`, `logic.js` and `style.css`.

### **That's it!** 
Reload the page, and your blog should be live!

## How to Post & Manage

**Logging In**

1. Go to your live site.
2. Click the **"Login"** button on the bottom of the sidebar.
3. Enter the **password** you created in Step 2.
4. The **Admin Dashboard** will appear.

### **Writing a "Leaflet" (Post)**
- Text: Type your update. You can use basic Markdown:
  - **bold** → bold
  - *italic* → italic
  - [Link](https://google.com) → Link
- Images (Video with Supporter):
  1. Click **"Choose File"** in the dashboard.
  2. Select an image or video from your computer.
  3. The system will automatically upload this file to your Neocities `img/` folder and attach it to your post 
- Alternatively, you can use the "Media Path" area to link to images, videos, or audio files and have them embed directly
- Click "Post & Sync".
- Watch the Sync Status indicator. When it turns green ("System Synced"), your post is live.

### Changing the Theme
Tired of your colors?

1. Log in to the **Dashboard**.
2. Click **"Site Settings"**.
3. Adjust colors, site name, or toggle comments.
4. Click **"Save Settings & Sync"**. The changes happen instantly.

### SEO & Metadata
Want your site to look good on Google or when shared on Discord/Twitter?

1. Go to **Site Settings > SEO & Metadata**.
2. Set your **Window Title** and **Meta Description**.
3. **Important:** After saving, click the **"⬇ HTML"** button in the dashboard to download a new `index.html`.
4. Manually upload this new `index.html` to Neocities. *(This is required because search engines read the raw HTML file, not the JavaScript loaded content)*.
