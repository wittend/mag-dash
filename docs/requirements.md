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
in the tab once it is loaded.  This file name can be in a slightly smaller font and/or 'elipsized'

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
