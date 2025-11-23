# Requirements for mag-dash

## Initial Description

Purpose:

* This is an interface that can present data ingested as JSON objects to present magnetometer as a time series visualization.

* It can use either a WebSocket URL or a local file name as a data source.

* It will present a tabbed interface (across the top)

*  Each new page will initially present a labeled and fielded set of inputs allowing the user to open either a URL for a WebSocket connection, or a local datafile for input on that page.  At the bottom right there will be two buttons, one labeled "connect" and another laveled "abandon".

* When a new page is used for the first time, a new tab will appear to the right of the selected tab, initialized for entry of information with a new source.

* A tab at the right-most position will present configuration information to be stored locally that contains persistent parameters global to this installation of the interface (To be defined).

* It may, in future, also log data as output to a database server (probably PostgreSQL), either on the local host or remotely via an Internet connection as it is received.

* In **WebSocket** mode it will provide a near realtime view of one or more host-local or remote ground-based magnetometer sites.

* In **WebSocket** mode the dashboard receives one JSON object per line from the WebSocket stream. Each line represents a single observation containing a timestamp value, sensor temperature, and the x, y, and z field vectors.

* Alternatively in **File** mode, the dashboard will be able to open a file selected by the user.  It may skip zero or more lines (default 0 - also entered by the user) as header information. It will process the samples in the same way as in the **WebSocket** mode. 

* The interface will use Icons, where appropriate, from the Tabler SVG outline collection.
 
* The User Interface will provide an Icon to toggle the entire program from light mode.  This must include all presentation pages, menus, popups, prompts, and controls, and maintain optimum readability.

* The program MUST offer to save any savable data to JSON-based files on closure or exit.

* This project should have appropriate documentation for a public Github repository. It should contain what is needed to create a Read theDocs documebtation site using Sphinx and a Furo theme.

Data Format:

- Baseline schema:
```
{ "ts": "DD Mon YYYY HH:MM:SS", "rt": <float>, "x": <float>, "y": <float>, "z": <float> }
```

`ts` (string): UTC timestamp formatted like `25 Oct 2025 14:02:33` (RFC‑2822‑like time portion without timezone offset).

`rt` (number): Sensor temperature in degrees Celsius.

`x`, `y`, `z` (number): Field components in nanoTesla (nT), with 3 decimal places printed.

- Example:
```
{ "ts":"26 Oct 2025 14:20:00", "rt": 24.1, "x":12345.678, "y":-234.500, "z":987.001 }
```


Units and scaling:

- Raw RM3100 counts are converted using configured gains and `NOS` (number‑of‑samples) register value.
- Magnetc vector samples are provided in nanoTesla (nT). 

Precision and rounding

* Values are printed with `%.3f` (three digits after decimal). This does not imply instrument accuracy; it is a display choice.

* This data will be presented as if it came from a websocket source.  It will be shown in descending order from most recent to oldest in the history window,

* To provide both  a graphically plotted time series view of sampling information with individual plots for sampled x, y and z vectors.

* To present a resizeable window showing a scrollable history of instantaneous samples ordered by their timestamps.

* The history window shows rows and columns demarcated with borders as in a spreadsheet

We got the layout working for now for this project.  But there are still things that need 
to be worked on. First I want to change the selection box on the new source page to maintain 
a history in local storage for the last 10 selections for the recently used Websocket URLs, 
Local Files, and the device paths used.   I would also like to have the local file browser 
to default to allow all file extensions.

I see some of what I need.  But selecting a local file seems to lock the page so badly 
that the browser completely hangs and gives a "web page not responding" popup and I have 
to kill the page.  I cannot see the problem in the dev tools.

I don't want the text. "Note: browsers cannot auto-open past files; select to recall the 
name only." to appear on the configuration page.  I would like an SVG spinner to appear 
while a local file is being loaded.  I want the file's name to replace the words "New Source" 
in the tab once it is loaded.  This file name can be in a slightly smaller font and/or 'ellipsis'

I don't like the phrase 'recent files" appearing above the recent files dropdown which it
does now.  I also don't like the fact that the "local device" and 'Websocket URL' boxes 
are hidden when other 'modes' are chosen.  I would like a new leftmost column in the 
history window that just shows the integer value of the lin's position in the loaded set.  

Ok, I see some improvement.  I would really like for the current page to remain selected 
when the local file has completed loading. Also, I don't see an x-scale (seconds) for the 
plotted data. I need that. It can be small but it must be synchronized with the already 
synchronized plots.

I would like a way to toggle the config  window between visible/hidden states and 
cause the right side of the window to resize correctly.

Ok. But I want the suggested options: 
- a global toggle in the top bar to apply to the active pane.
- We can also add an accessible `aria-expanded` on the toggle button and a keyboard shortcut if desired.

Now due to changes in styling, any tab that is selectes in dark mode is unreadable

At no time do see any of the SVG Icons that I specified when I push the project to GitHub my IDE
reports errors relating to the Tabler SVG Icon set that I specified from the beginning 
(referenced in a script tag in web/index.html). Why is this happening and how can I fix it?

I would like to 'vendor' the assets for offline use.

When I run "deno run -A scripts/vendor_tabler_icons.ts 3.35.0" I get:
Vendoring Tabler Icons webfont v3.35.0...
Fetching CSS: https://unpkg.com/@tabler/icons-webfont@3.35.0/tabler-icons.min.css
Error: Failed to fetch https://unpkg.com/@tabler/icons-webfont@3.35.0/tabler-icons.min.css: 404 Not Found
at download (file:///home/dave/Projects/deno-dev/mag-dash/scripts/vendor_tabler_icons.ts:23:22)
at eventLoopTick (ext:core/01_core.js:179:7)
at async main (file:///home/dave/Projects/deno-dev/mag-dash/scripts/vendor_tabler_icons.ts:54:18)

When connected ro the network the Icons now appear as expected.  But when i disconnect from the network and do a hard reset on the browser page, I get the following console messages: ":8000/:11  GET https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.35.0/dist/tabler-icons.min.css net::ERR_INTERNET_DISCONNECTED
app.js:885 [Intervention] Slow network is detected. See https://www.chromestatus.com/feature/5636954674692096 for more details. Fallback font will be used while loading: http://localhost:8000/web/vendor/tabler/icons-webfont/3.35.0/fonts/tabler-icons.woff2?v3.35.0
(index):1 Failed to decode downloaded font: http://localhost:8000/web/vendor/tabler/icons-webfont/3.35.0/fonts/tabler-icons.woff2?v3.35.0
(index):1 OTS parsing error: invalid sfntVersion: 1008813135
(index):1 [Intervention] Slow network is detected. See https://www.chromestatus.com/feature/5636954674692096 for more details. Fallback font will be used while loading: http://localhost:8000/web/vendor/tabler/icons-webfont/3.35.0/fonts/tabler-icons.woff?
(index):1 Failed to decode downloaded font: http://localhost:8000/web/vendor/tabler/icons-webfont/3.35.0/fonts/tabler-icons.woff?
(index):1 OTS parsing error: invalid sfntVersion: 1008813135
(index):1 [Intervention] Slow network is detected. See https://www.chromestatus.com/feature/5636954674692096 for more details. Fallback font will be used while loading: http://localhost:8000/web/vendor/tabler/icons-webfont/3.35.0/fonts/tabler-icons.ttf?v3.35.0
(index):1 Failed to decode downloaded font: http://localhost:8000/web/vendor/tabler/icons-webfont/3.35.0/fonts/tabler-icons.ttf?v3.35.0
(index):1 OTS parsing error: invalid sfntVersion: 1008813135

After an offline hard reload, under response I see three response entries.  Each shows as data where 
the first four bytes seem to be '.png' .  Under 'headers' I see three requests all of which appear 
under 'preview' to be for .png files related to Deno's branding.

I see from a seperate web search : "The Tabler SVG Icons are available on GitHub through the repository hashrock/tabler-icons-tsx, which provides a TypeScript/JSX implementation for use in Deno applications, particularly with the Fresh framework.
However, the library is currently deprecated and will not be updated beyond Tabler Icons version 2.47.0 due to a major version upgrade that broke the existing conversion script.
As a result, it is recommended to either use the original Tabler Icons via npm or republish them to JSR, as JSR is now preferred over deno.land/x.".  Should I be using something else?

When I do the first step above, I get the following in my terminal: "deno task vendor:tabler
Task vendor:tabler deno run -A scripts/vendor_tabler_icons.ts 3.35.0
Vendoring Tabler Icons webfont v3.35.0...
Trying CSS: https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.35.0/dist/tabler-icons.min.css
Using CSS: https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.35.0/dist/tabler-icons.min.css
ReferenceError: fontUrls is not defined
at main (file:///home/dave/Projects/deno-dev/mag-dash/scripts/vendor_tabler_icons.ts:104:3)
at eventLoopTick (ext:core/01_core.js:179:7)
dave@LP-Sig0:~/Projects/deno-dev/mag-dash" 

I tried this and I don't see any errors in the dev tools.  I would like these resources to be 
completely offline for all use cases.  Some use cases (Web Sockets, Database access) will require network 
access, but visual resources such as icons and svgs do not require that.

I repeated the `deno task vendor:tabler` command and it looked fine.  Then I ran `deno task dev` and went 
to the browser.  Though I am connected to the internet, when I  did a `delete cache and hard reload` 
I got NO visible content. In the devtools I see network erros indicating that it is falling back to 
deno branding.  I think.

I did tasks 1) & 2).  When I reloaded the localhost:8000 URL I got almost nothing. Probably the index.html and nothing else.  I closed and restarted the deno server and the browser and still got the same results.  The dev tools shoe six errors and two 'issues'.  The console errors are as follows: "styles.css:1  Failed to load resource: the server responded with a status of 404 (Not Found)
tabler-icons.min.css:1  Failed to load resource: the server responded with a status of 404 (Not Found)
app.js:1  Failed to load resource: the server responded with a status of 404 (Not Found)
:8000/web/icon.svg:1  Failed to load resource: the server responded with a status of 404 (Not Found)
styles.css:1  Failed to load resource: the server responded with a status of 404 (Not Found)
tabler-icons.min.css:1  Failed to load resource: the server responded with a status of 404 (Not Found)
"

That seems to have made things much better.

now the 'clear history' buttons are too close to the rntry fields and get covered up.  I woulfd also like 
to remove the 'Hide' button on the control page and just keep the one on the top bar.

Now the page doesn't load at all after rerunning `deno task dev` and performing a hardreload of the page.  
This looks a lot like the same problem that keeps happening every time we make UI changes. The page shown 
is just the browser's 'No Internet' page. 

I believe that you are wrong.  I left the server running before your last tests because you did not 
tell me to cancel it.  I have done so now.  I then followed your instructions and attempted to access 
the healthz URL.  Same behavior.  I searched the output from the ps command and could finf no evidence 
of any process relating to the server.  Can you check again?

http://localhost:8000/healthz

Next steps
What the new logs show
Thanks for the detailed server console output — that’s very helpful. The logs clearly show the server is receiving requests and serving your static files with 200 OK:
•
/healthz → 200 OK
•
/web/styles.css → 200 OK (resolved to your filesystem path under web/styles.css)
•
/web/vendor/tabler/.../tabler-icons.min.css → 200 OK
From the server’s perspective, the assets are being served correctly now.
If the browser still fails to load the page
Given the 200s above, if the browser still shows the offline page or fails to render, the problem is likely outside the server (e.g., browser cache/state, address resolution, or a transient reload while the server was restarting). Please try these quick checks:
1)
Confirm you’re using HTTP, not HTTPS
•
The server runs on plain HTTP. Ensure the address bar is http://localhost:8000/ (not https://...). Some browsers can remember HSTS or try HTTPS first if you used it for another service.
2)
Try explicit IPv4 loopback
•
Some systems prefer IPv6 for localhost. Try: http://127.0.0.1:8000/.
•
If this works while http://localhost:8000/ doesn’t, it points to a local hosts/DNS/IPv6 quirk.
3)
Try the alternate port (to rule out local firewall/port policy)
•
Stop the server and run: PORT=8080 deno task dev:8080
•
Then open: http://localhost:8080/
4)
Double‑check the three asset URLs directly in the browser
•
http://localhost:8000/web/styles.css
•
http://localhost:8000/web/app.js
•
http://localhost:8000/web/vendor/tabler/icons-webfont/3.35.0/tabler-icons.min.css If these show content (and the server logs 200), but the main page still looks blank, open DevTools → Console and Network and share any errors you see (e.g., JavaScript errors, blocked resources).
5)
Clear browser state for this origin
•
Application tab → Clear storage → Clear site data, then reload.
•
Ensure no Service Worker is registered (we don’t use one, but if one was left from another experiment, unregister it).
Optional server hardening (if you want me to implement)
•
Bind to an IPv6 dual‑stack host if needed (some environments prefer ::1 for localhost). Currently we listen on 0.0.0.0 (IPv4). If you’d like, I can switch to hostname: "::" so it accepts IPv6 and, on many OSes, IPv4 via dual‑stack.
•
Keep the improved logs for a bit; once things are stable, we can tone them down.
Next step
Since the server is definitely serving assets now, please:
•
Load http://127.0.0.1:8000/ and/or http://localhost:8080/ and let me know if the page renders.
•
If it still doesn’t render, paste any Console/Network errors from DevTools.
With that info I can finalize either a small binding tweak (IPv6) or address any remaining client‑side hiccup immediately.


---------------------

Ok, This project seems back on track but there are some important changes that I need. - First, I want to remove the 
buttons in the config page that clear the history lists for the 'WebSocket URL', 'File path', and 'Device path' entry boxes.

Ok, next I want to place a small icon after the source name, possibly just a small 'x', in the Tab of each opened 
source. This button will be the equivalent to the 'abandon' button on the config page for just that tab page. 

Ok, but the close/abandon icon/event should not be placed into the tab labeled 'New Source".  
That tab should always be present.

This last change seems to have broken what we had before.  While it removed the 'x'/'abandon' icon from the  'New Source' 
tab, that icon & functionality is no longer visible in the loaded/active tabs, either, as it should be.

---------------------

Now I would like to remove the 'Abandon' button all together from the config page but leave all other functionality intact.

---------------------

Ok, I would also like to remove the dropdown box related to 'Local File' that shows recent files. It is not useful and 
just complicates the config page.

---------------------
Ok, I would like for the native file picker input to not show the text "Choose File" but to only show a small 
file-open Icon.  I also want it to be placed to the entirely to the left of the file name box with enough padding to 
prevent it from obscuring the contents of the file name box.
---------------------






