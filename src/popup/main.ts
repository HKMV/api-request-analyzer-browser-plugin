import 'uno.css'
import App from './App.svelte'
import '../app.css'

window.addEventListener('error', e => console.error('[API Analyzer]', e.message, e.error))

const app = new App({ target: document.getElementById('app')! })
export default app
