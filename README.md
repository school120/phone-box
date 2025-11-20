# phone-box

Phone cabinet / phone box scanner that uses OpenAI vision to detect **empty slots** in a cabinet and match them to students who have not turned in their phones.

- Frontend: plain HTML + React (via CDN) + Tailwind, suitable for **GitHub Pages**.
- Backend: small Node/Express server using the OpenAI **Responses API** (`gpt-4.1-mini`) with vision.

---

## Project structure

```text
phone-box/
  public/
    index.html      # Frontend UI (static, for GitHub Pages)
  server.mjs        # Backend (Node + Express + OpenAI)
  package.json
  README.md
```

---

## 1. Frontend (GitHub Pages)

The frontend lives in `public/index.html`.

To use GitHub Pages:

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set:
   - Source: **Deploy from branch**
   - Branch: `main`
   - Folder: `/public`
4. Save. GitHub will give you a Pages URL like:

   `https://YOUR_USERNAME.github.io/phone-box/`

### Important: configure backend URL

In `public/index.html`, at the top of the `<script>`:

```js
const API_BASE_URL = 'https://YOUR_BACKEND_URL_HERE';
```

Change this to your deployed backend URL (no trailing slash), e.g.:

```js
const API_BASE_URL = 'https://phone-box-backend.onrender.com';
```

The frontend will call:

```http
POST {API_BASE_URL}/api/analyze-cabinet
```

with a JSON body containing the data URL image and the prompt.

---

## 2. Backend (Node + OpenAI vision)

The backend is `server.mjs`. It exposes:

- `POST /api/analyze-cabinet`

Expected request body:

```json
{
  "imageData": "data:image/jpeg;base64,...",
  "prompt": "instructions for the model"
}
```

Response:

```json
{
  "emptySlots": [1, 5, 23, 34],
  "totalSlotsVisible": 60,
  "confidence": "high"
}
```

### Running locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set your OpenAI API key:

   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. The backend will listen on `http://localhost:3001`.

If you want to test the frontend locally too, you can either:

- Open `public/index.html` directly in your browser and set:

  ```js
  const API_BASE_URL = 'http://localhost:3001';
  ```

- Or serve `public` with a static file server (e.g., `npx serve public`).

---

## 3. Deploying the backend from GitHub

You can use any Node host that connects to GitHub (Render, Railway, Vercel, etc.). The basic steps are:

1. Create a new **web service** / **project** from your **phone-box** GitHub repo.
2. Set:
   - Root directory: repo root
   - Start command: `npm start`
3. In that host's dashboard, add an environment variable:

   - `OPENAI_API_KEY = sk-...`

4. Deploy. You'll get a URL like:

   `https://phone-box-backend.onrender.com`

5. Put that URL into `public/index.html`:

   ```js
   const API_BASE_URL = 'https://phone-box-backend.onrender.com';
   ```

Commit and push. GitHub Pages will redeploy and your frontend will now talk to your backend.

---

## 4. How the analysis works

1. Teacher:
   - Loads roster from Google Sheets **or** uploads a CSV.
   - Optionally uploads an absent list (names or IDs).
   - Selects a box (e.g., `9A`).
   - Takes or uploads a cabinet photo.

2. Frontend:
   - Filters students whose `securityNumber` starts with the selected box code.
   - Sends the image + a detailed prompt to the backend.

3. Backend:
   - Calls the OpenAI Responses API with:
     - The prompt describing the 1–60 slot grid.
     - The cabinet image as a data URL.
   - Asks the model to return JSON: `emptySlots`, `totalSlotsVisible`, `confidence`.

4. Frontend:
   - Maps `emptySlots` to particular students by matching the numeric part at the end of `securityNumber`.
   - Splits them into:
     - Present but missing phone (not on absent list).
     - Absent and missing phone (explained by absence).
   - Renders the results.

---

## 5. Customization ideas

- Adjust the prompt for different cabinet layouts (different slot counts, labeling, or grid shape).
- Change how `securityNumber` encodes the slot (right now it assumes the numeric suffix is the slot).
- Add logging or a simple admin view to see historical scans.
- Move this into a full React/Vite project later, reusing the backend as-is.

---

Happy scanning 📱📦
