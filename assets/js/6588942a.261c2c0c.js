"use strict";(self.webpackChunk=self.webpackChunk||[]).push([[9919],{3905:(e,t,r)=>{r.d(t,{Zo:()=>i,kt:()=>d});var n=r(7294);function a(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function l(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function o(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?l(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):l(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function s(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},l=Object.keys(e);for(n=0;n<l.length;n++)r=l[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(n=0;n<l.length;n++)r=l[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var p=n.createContext({}),u=function(e){var t=n.useContext(p),r=t;return e&&(r="function"==typeof e?e(t):o(o({},t),e)),r},i=function(e){var t=u(e.components);return n.createElement(p.Provider,{value:t},e.children)},c={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},m=n.forwardRef((function(e,t){var r=e.components,a=e.mdxType,l=e.originalType,p=e.parentName,i=s(e,["components","mdxType","originalType","parentName"]),m=u(r),d=a,h=m["".concat(p,".").concat(d)]||m[d]||c[d]||l;return r?n.createElement(h,o(o({ref:t},i),{},{components:r})):n.createElement(h,o({ref:t},i))}));function d(e,t){var r=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var l=r.length,o=new Array(l);o[0]=m;var s={};for(var p in t)hasOwnProperty.call(t,p)&&(s[p]=t[p]);s.originalType=e,s.mdxType="string"==typeof e?e:a,o[1]=s;for(var u=2;u<l;u++)o[u]=r[u];return n.createElement.apply(null,o)}return n.createElement.apply(null,r)}m.displayName="MDXCreateElement"},5162:(e,t,r)=>{r.d(t,{Z:()=>o});var n=r(7294),a=r(6010);const l="tabItem_Ymn6";function o(e){var t=e.children,r=e.hidden,o=e.className;return n.createElement("div",{role:"tabpanel",className:(0,a.Z)(l,o),hidden:r},t)}},5488:(e,t,r)=>{r.d(t,{Z:()=>d});var n=r(7462),a=r(7294),l=r(6010),o=r(2389),s=r(7392),p=r(7094),u=r(2466);const i="tabList__CuJ",c="tabItem_LNqP";function m(e){var t,r,o=e.lazy,m=e.block,d=e.defaultValue,h=e.values,w=e.groupId,v=e.className,f=a.Children.map(e.children,(function(e){if((0,a.isValidElement)(e)&&"value"in e.props)return e;throw new Error("Docusaurus error: Bad <Tabs> child <"+("string"==typeof e.type?e.type:e.type.name)+'>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.')})),g=null!=h?h:f.map((function(e){var t=e.props;return{value:t.value,label:t.label,attributes:t.attributes}})),y=(0,s.l)(g,(function(e,t){return e.value===t.value}));if(y.length>0)throw new Error('Docusaurus error: Duplicate values "'+y.map((function(e){return e.value})).join(", ")+'" found in <Tabs>. Every value needs to be unique.');var b=null===d?d:null!=(t=null!=d?d:null==(r=f.find((function(e){return e.props.default})))?void 0:r.props.value)?t:f[0].props.value;if(null!==b&&!g.some((function(e){return e.value===b})))throw new Error('Docusaurus error: The <Tabs> has a defaultValue "'+b+'" but none of its children has the corresponding value. Available values are: '+g.map((function(e){return e.value})).join(", ")+". If you intend to show no default tab, use defaultValue={null} instead.");var k=(0,p.U)(),C=k.tabGroupChoices,x=k.setTabGroupChoices,P=(0,a.useState)(b),N=P[0],T=P[1],O=[],S=(0,u.o5)().blockElementScrollPositionUntilNextRender;if(null!=w){var E=C[w];null!=E&&E!==N&&g.some((function(e){return e.value===E}))&&T(E)}var U=function(e){var t=e.currentTarget,r=O.indexOf(t),n=g[r].value;n!==N&&(S(t),T(n),null!=w&&x(w,String(n)))},Z=function(e){var t,r=null;switch(e.key){case"ArrowRight":var n,a=O.indexOf(e.currentTarget)+1;r=null!=(n=O[a])?n:O[0];break;case"ArrowLeft":var l,o=O.indexOf(e.currentTarget)-1;r=null!=(l=O[o])?l:O[O.length-1]}null==(t=r)||t.focus()};return a.createElement("div",{className:(0,l.Z)("tabs-container",i)},a.createElement("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,l.Z)("tabs",{"tabs--block":m},v)},g.map((function(e){var t=e.value,r=e.label,o=e.attributes;return a.createElement("li",(0,n.Z)({role:"tab",tabIndex:N===t?0:-1,"aria-selected":N===t,key:t,ref:function(e){return O.push(e)},onKeyDown:Z,onFocus:U,onClick:U},o,{className:(0,l.Z)("tabs__item",c,null==o?void 0:o.className,{"tabs__item--active":N===t})}),null!=r?r:t)}))),o?(0,a.cloneElement)(f.filter((function(e){return e.props.value===N}))[0],{className:"margin-top--md"}):a.createElement("div",{className:"margin-top--md"},f.map((function(e,t){return(0,a.cloneElement)(e,{key:t,hidden:e.props.value!==N})}))))}function d(e){var t=(0,o.Z)();return a.createElement(m,(0,n.Z)({key:String(t)},e))}},4959:(e,t,r)=>{r.d(t,{Z:()=>s});var n=r(7294),a=r(9960),l=r(4477),o=r(2263);const s=function(e){var t=e.to,r=e.children,s=(0,l.E)();return(0,o.default)().siteConfig.presets[0][1].docs.disableVersioning?n.createElement(a.default,{to:"/api/"+t},r):n.createElement(a.default,{to:"/api/"+("current"===s.version?"next":s.version)+"/"+t},r)}},9739:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>h,contentTitle:()=>m,default:()=>f,frontMatter:()=>c,metadata:()=>d,toc:()=>w});var n=r(7462),a=r(3366),l=(r(7294),r(3905)),o=r(5488),s=r(5162),p=r(1435),u=r(4959);var i=["components"],c={id:"capture-screenshot",title:"Capture a screenshot using Puppeteer"},m=void 0,d={unversionedId:"examples/capture-screenshot",id:"examples/capture-screenshot",title:"Capture a screenshot using Puppeteer",description:"Using Puppeteer directly",source:"@site/../docs/examples/puppeteer_capture_screenshot.mdx",sourceDirName:"examples",slug:"/examples/capture-screenshot",permalink:"/apify-ts/docs/examples/capture-screenshot",draft:!1,tags:[],version:"current",lastUpdatedBy:"Martin Ad\xe1mek",lastUpdatedAt:1654606074,formattedLastUpdatedAt:"6/7/2022",frontMatter:{id:"capture-screenshot",title:"Capture a screenshot using Puppeteer"},sidebar:"docs",previous:{title:"Playwright crawler",permalink:"/apify-ts/docs/examples/playwright-crawler"},next:{title:"Puppeteer crawler",permalink:"/apify-ts/docs/examples/puppeteer-crawler"}},h={},w=[{value:"Using Puppeteer directly",id:"using-puppeteer-directly",level:2},{value:"Using <code>PuppeteerCrawler</code>",id:"using-puppeteercrawler",level:2}],v={toc:w};function f(e){var t=e.components,r=(0,a.Z)(e,i);return(0,l.kt)("wrapper",(0,n.Z)({},v,r,{components:t,mdxType:"MDXLayout"}),(0,l.kt)("h2",{id:"using-puppeteer-directly"},"Using Puppeteer directly"),(0,l.kt)("div",{className:"admonition admonition-tip alert alert--success"},(0,l.kt)("div",{parentName:"div",className:"admonition-heading"},(0,l.kt)("h5",{parentName:"div"},(0,l.kt)("span",{parentName:"h5",className:"admonition-icon"},(0,l.kt)("svg",{parentName:"span",xmlns:"http://www.w3.org/2000/svg",width:"12",height:"16",viewBox:"0 0 12 16"},(0,l.kt)("path",{parentName:"svg",fillRule:"evenodd",d:"M6.5 0C3.48 0 1 2.19 1 5c0 .92.55 2.25 1 3 1.34 2.25 1.78 2.78 2 4v1h5v-1c.22-1.22.66-1.75 2-4 .45-.75 1-2.08 1-3 0-2.81-2.48-5-5.5-5zm3.64 7.48c-.25.44-.47.8-.67 1.11-.86 1.41-1.25 2.06-1.45 3.23-.02.05-.02.11-.02.17H5c0-.06 0-.13-.02-.17-.2-1.17-.59-1.83-1.45-3.23-.2-.31-.42-.67-.67-1.11C2.44 6.78 2 5.65 2 5c0-2.2 2.02-4 4.5-4 1.22 0 2.36.42 3.22 1.19C10.55 2.94 11 3.94 11 5c0 .66-.44 1.78-.86 2.48zM4 14h5c-.23 1.14-1.3 2-2.5 2s-2.27-.86-2.5-2z"}))),"tip")),(0,l.kt)("div",{parentName:"div",className:"admonition-content"},(0,l.kt)("p",{parentName:"div"},"To run this example on the Apify Platform, select the ",(0,l.kt)("inlineCode",{parentName:"p"},"apify/actor-node-puppeteer-chrome")," image for your Dockerfile."))),(0,l.kt)("p",null,"This example captures a screenshot of a web page using ",(0,l.kt)("inlineCode",{parentName:"p"},"Puppeteer"),". It would look almost exactly the same with ",(0,l.kt)("inlineCode",{parentName:"p"},"Playwright"),"."),(0,l.kt)(o.Z,{groupId:"puppeteer-capture-screenshot",mdxType:"Tabs"},(0,l.kt)(s.Z,{value:"pagescreenshot",label:"Page Screenshot",mdxType:"TabItem"},(0,l.kt)("p",null,"Using ",(0,l.kt)("inlineCode",{parentName:"p"},"page.screenshot()"),":"),(0,l.kt)(p.Z,{className:"language-js",mdxType:"CodeBlock"},"import { KeyValueStore, launchPuppeteer } from '@crawlee/puppeteer';\n\nconst keyValueStore = await KeyValueStore.open();\n\nconst url = 'http://www.example.com/';\n// Start a browser\nconst browser = await launchPuppeteer();\n\n// Open new tab in the browser\nconst page = await browser.newPage();\n\n// Navigate to the URL\nawait page.goto(url);\n\n// Capture the screenshot\nconst screenshot = await page.screenshot();\n\n// Save the screenshot to the default key-value store\nawait keyValueStore.setValue('my-key', screenshot, { contentType: 'image/png' });\n\n// Close Puppeteer\nawait browser.close();\n")),(0,l.kt)(s.Z,{value:"crawlerutilsscreenshot",label:"Crawler Utils Screenshot",default:!0,mdxType:"TabItem"},(0,l.kt)("p",null,"Using ",(0,l.kt)("inlineCode",{parentName:"p"},"puppeteerUtils.saveSnapshot()"),":"),(0,l.kt)(p.Z,{className:"language-js",mdxType:"CodeBlock"},"import { launchPuppeteer, puppeteerUtils } from '@crawlee/puppeteer';\n\nconst url = 'http://www.example.com/';\n// Start a browser\nconst browser = await launchPuppeteer();\n\n// Open new tab in the browser\nconst page = await browser.newPage();\n\n// Navigate to the URL\nawait page.goto(url);\n\n// Capture the screenshot\nawait puppeteerUtils.saveSnapshot(page, { key: 'my-key', saveHtml: false });\n\n// Close Puppeteer\nawait browser.close();\n"))),(0,l.kt)("h2",{id:"using-puppeteercrawler"},"Using ",(0,l.kt)("inlineCode",{parentName:"h2"},"PuppeteerCrawler")),(0,l.kt)("p",null,"This example captures a screenshot of multiple web pages when using ",(0,l.kt)("inlineCode",{parentName:"p"},"PuppeteerCrawler"),":"),(0,l.kt)(o.Z,{groupId:"puppeteer-capture-screenshot",mdxType:"Tabs"},(0,l.kt)(s.Z,{value:"pagescreenshot",label:"Page Screenshot",mdxType:"TabItem"},(0,l.kt)("p",null,"Using ",(0,l.kt)("inlineCode",{parentName:"p"},"page.screenshot()"),":"),(0,l.kt)(p.Z,{className:"language-js",mdxType:"CodeBlock"},"import { PuppeteerCrawler, KeyValueStore } from '@crawlee/puppeteer';\n\nconst keyValueStore = await KeyValueStore.open();\n\n// Create a PuppeteerCrawler\nconst crawler = new PuppeteerCrawler({\n    async requestHandler({ request, page }) {\n        // Capture the screenshot with Puppeteer\n        const screenshot = await page.screenshot();\n        // Convert the URL into a valid key\n        const key = request.url.replace(/[:/]/g, '_');\n        // Save the screenshot to the default key-value store\n        await keyValueStore.setValue(key, screenshot, { contentType: 'image/png' });\n    },\n});\n\nawait crawler.addRequests([\n    { url: 'http://www.example.com/page-1' },\n    { url: 'http://www.example.com/page-2' },\n    { url: 'http://www.example.com/page-3' },\n]);\n\n// Run the crawler\nawait crawler.run();\n")),(0,l.kt)(s.Z,{value:"crawlerutilsscreenshot",label:"Crawler Utils Screenshot",default:!0,mdxType:"TabItem"},(0,l.kt)("p",null,"Using the context-aware ",(0,l.kt)(u.Z,{to:"puppeteer-crawler/namespace/puppeteerUtils#saveSnapshot",mdxType:"ApiLink"},(0,l.kt)("inlineCode",{parentName:"p"},"saveSnapshot()"))," utility:"),(0,l.kt)(p.Z,{className:"language-js",mdxType:"CodeBlock"},"import { PuppeteerCrawler } from '@crawlee/puppeteer';\n\n// Create a PuppeteerCrawler\nconst crawler = new PuppeteerCrawler({\n    async requestHandler({ request, saveSnapshot }) {\n        // Convert the URL into a valid key\n        const key = request.url.replace(/[:/]/g, '_');\n        // Capture the screenshot\n        await saveSnapshot({ key, saveHtml: false });\n    },\n});\n\nawait crawler.addRequests([\n    { url: 'http://www.example.com/page-1' },\n    { url: 'http://www.example.com/page-2' },\n    { url: 'http://www.example.com/page-3' },\n]);\n\n// Run the crawler\nawait crawler.run();\n"))),(0,l.kt)("p",null,"In both examples using ",(0,l.kt)("inlineCode",{parentName:"p"},"page.screenshot()"),", a ",(0,l.kt)("inlineCode",{parentName:"p"},"key")," variable is created based on the URL of the web page. This variable is used as the key when saving\neach screenshot into a key-value store."))}f.isMDXComponent=!0}}]);