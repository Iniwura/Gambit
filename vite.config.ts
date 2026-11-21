import {defineConfig} from 'vite';
import {resolve} from 'node:path';

// Keep the game and opt-in, wallet-signed testnet deployment helper separate.
export default defineConfig({
  build:{
    rollupOptions:{
      input:{
        game:resolve(__dirname,'index.html'),
        deployment:resolve(__dirname,'deploy.html')
      }
    }
  }
});
