import {defineConfig} from 'tsup';
export default defineConfig({entry:['src/index.tsx'],format:['esm'],dts:true,external:['react','react-dom','agentation'],clean:true,banner:{js:'"use client";'}});
