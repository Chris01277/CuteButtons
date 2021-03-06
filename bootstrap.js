"use strict";
/* jshint ignore:start */
const {classes: Cc, interfaces: Ci, utils: Cu, manager: Cm, results: Cr} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
/* jshint ignore:end */
//Services.console.logStringMessage("CuteButtons:\n " + "XXX");

//test if this is still needed on older versions, or if flushBundles is fine
//name.properties?' + Math.random()),
var stringBundle = Services.strings.createBundle('chrome://cutebuttons/locale/name.properties'),
aReasonWindow = null;

  function startup(aData, aReason)
  {
    //Firefox 8.0-9.0
    if (Services.appinfo.ID != "{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}" &&
        Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0) {
        Cm.addBootstrappedManifestLocation(aData.installPath);
      try {
      } catch(e) {//FF 4.0-7.0
        Services.console.logStringMessage("CuteButtons:\n " + "Know a way to load chrome.manifest without addBootstrappedManifestLocation?");
        throw (e);
      }
    }

    //make sure JSMs are fresh
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);
    //same for strings on old fox?
    Services.strings.flushBundles();

    var prefsD = Services.prefs.getDefaultBranch("extensions.cutebuttons.");
    //load default prefs
    prefsD.setCharPref("cssdate","");
    prefsD.setBoolPref("buttonicons",true);
    prefsD.setBoolPref("menuicons",true);
    prefsD.setBoolPref("checkboxiconsbutton",true);
    prefsD.setBoolPref("checkboxiconsbuttonhover",true);
    if (Services.appinfo.OS == "Darwin" ||
        Services.appinfo.OS == "Linux") {
      prefsD.setBoolPref("blurdisabled",false);
      prefsD.setIntPref("mosaicnormal",0);
      prefsD.setIntPref("mosaichover",2);
      prefsD.setIntPref("mosaicnormalwhich",0);
      prefsD.setIntPref("mosaichoverwhich",2);
      //OSX: half the menuitems have checked=false, so turn these off
      //Linux: doesn't seem to have support for menuitems :hover
      //Linux: has built in checkmarks/radios that don't seem to turn off
      prefsD.setBoolPref("checkboxiconsmenu",false);
      prefsD.setBoolPref("checkboxiconsmenuhover",false);
      //they don't show up anywhere that I know of
      prefsD.setBoolPref("radioiconsmenu",false);
      prefsD.setBoolPref("radioiconsmenuhover",false);
    } else {
      prefsD.setBoolPref("blurdisabled",true);
      prefsD.setIntPref("mosaicnormal",1);
      prefsD.setIntPref("mosaichover",0);
      prefsD.setIntPref("mosaicnormalwhich",1);
      prefsD.setIntPref("mosaichoverwhich",0);
      prefsD.setBoolPref("checkboxiconsmenu",true);
      prefsD.setBoolPref("checkboxiconsmenuhover",true);
      prefsD.setBoolPref("radioiconsmenu",true);
      prefsD.setBoolPref("radioiconsmenuhover",true);
    }
    prefsD.setBoolPref("radioiconsbutton",true);
    prefsD.setBoolPref("radioiconsbuttonhover",true);
    prefsD.setBoolPref("icons",true);
    prefsD.setBoolPref("iconshover",true);
    prefsD.setBoolPref("rotateicons",true);
    prefsD.setBoolPref("statusbar",true);
    prefsD.setBoolPref("disabletoolbarbutton",false);

    Cu.import("chrome://cutebuttons/content/common.jsm");
    Cu.import("chrome://cutebuttons/content/overlay.jsm");

    //https://github.com/dgutov/bmreplace
    Services.scriptloader.loadSubScript(addon.getResourceURI("includes/buttons.js").spec, self);
    if (ADDON_INSTALL == aReason)
      setDefaultPosition("cutebuttons-toolbar-button",toolButtonLoc()[0],toolButtonLoc()[1]);

    //if we're using _TEST version
    cbCommon.addonID = aData.id;

    // Load into any existing windows
    forEachOpenWindow(loadIntoWindow);
    // Load into any new windows
    Services.wm.addListener(WindowListener);
    //used to check if we're starting up gecko or enabling addon
    aReasonWindow = aReason;
  }

  function loadIntoWindow(window)
  {
    if (!window)
      return;

    var doc = window.document,
      win = doc.querySelector("window");

    if (cbCommon.prefs.getBoolPref("disabletoolbarbutton") == false){
      // Add toolbar button
      var button = doc.createElement("toolbarbutton");
      button.setAttribute("id", "cutebuttons-toolbar-button");
      button.setAttribute("label", stringBundle.GetStringFromName("CuteButtons"));
      button.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
      button.addEventListener('click', function(event) {
        //Services: needed for TB 8.0
        cbOverlay.openOptions(event.button,Services);
      }, false);
      restorePosition(doc, button);
    }

    //only delay on gecko start
    var timeout = 0;
    if (APP_STARTUP == aReasonWindow)
      timeout = 1000;

    //let firstPaint go first
    window.setTimeout(function() {
      //run some window stuff
      cbOverlay.name = stringBundle.GetStringFromName("CuteButtons");
      cbOverlay.init(window);
    },timeout);
    //other than for the toolbarbutton
    if (!cbOverlay.startup)
      cbOverlay.applyStyle("toolbarbutton.css",true);

    //https://github.com/dgutov/bmreplace
    unload(function() {
      if (button)
        button.parentNode.removeChild(button);
      prefHandlers.splice(handlerIdx, 1);
    }, window);
  }

  function shutdown(aData, aReason)
  {
    // When the application is shutting down we normally don't have to clean
    // up any UI changes made
    if (aReason == APP_SHUTDOWN)
      return;

    //https://github.com/dgutov/bmreplace
    unload();

    // Unload from any existing windows
    forEachOpenWindow(unloadFromWindow);
    // Stop listening for new windows
    Services.wm.removeListener(WindowListener);

    //unregister registered stylesheets
    cbOverlay.unLoadCSS();

    //correct way to remove a MutationObserver?
    if (cbOverlay.mutationOb)
      cbOverlay.mutationOb.disconnect();

    //uninstall addon
    if (ADDON_UNINSTALL == aReason) {
      //remove prefs
      Services.prefs.getBranch("extensions.cutebuttons.").deleteBranch("");
      //delete profile\CuteButtonsSVG directory
      try {
        //fails if user has file opened, so try block it is
        cbCommon.cleanUpProfileDir();
      } catch(e) {
        cbCommon.dump('Failed to remove "CuteButtonsSVG" directory from user profile');
        if (e.stack)
          Cu.reportError(e.stack);
      }
    }

    //unload JSMs
    Cu.unload("chrome://cutebuttons/content/common.jsm");
    Cu.unload("chrome://cutebuttons/content/overlay.jsm");

    //support older firefoxes
    if (Services.appinfo.ID != "{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}" &&
        Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
      Components.manager.removeBootstrappedManifestLocation(aData.installPath);

    // HACK WARNING: The Addon Manager does not properly clear all addon related caches on update;
    //               in order to fully update images and locales, their caches need clearing here
    Services.obs.notifyObservers(null, "chrome-flush-caches", null);
  }

  function unloadFromWindow(window)
  {
    if (!window)
      return;

    function deleteEl(type)
    {
      var element = window.document.getElementById(type);
      if (element)
        element.parentNode.removeChild(element);
    }
    deleteEl("status4evar-status-image");
    //for some versions the toolbarbutton gets left in the toolbar
    deleteEl("cutebuttons-toolbar-button");

    //for some versions the toolbarbutton gets left in the palette
    //probably a better way to do this...
    function deletePal(type)
    {
      var toolbox = window.document.getElementById(type);
      if (!toolbox)
        return;
        for (var i = 0; i < toolbox.palette.childNodes.length; i++) {
          var item = toolbox.palette.childNodes[i];
          if (item.id == "cutebuttons-toolbar-button"){
            cbCommon.dump("===");
            try {
            item.boxObject.element.remove();
            item.remove();
            } catch(e){/*already removed, or just not there so ignore*/}
          }
        }
    }
    deletePal("navigator-toolbox");
    deletePal("mail-toolbox");
  }

  function forEachOpenWindow(todo)  // Apply a function to all open browser windows
  {
    function enumWin(wintype)
    {
      var windows = Services.wm.getEnumerator(wintype);
      while (windows.hasMoreElements())
        todo(windows.getNext().QueryInterface(Ci.nsIDOMWindow));
    }
    enumWin("navigator:browser");
    enumWin("mail:3pane");
  }

  var WindowListener = {
    onOpenWindow: function(xulWindow)
    {
      var window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
      function onWindowLoad()
      {
        window.removeEventListener("load",onWindowLoad);
        var element = window.document.documentElement;
        if (element.getAttribute("windowtype") == "navigator:browser" || element.getAttribute("windowtype") == "mail:3pane")
          loadIntoWindow(window);
      }
      window.addEventListener("load",onWindowLoad);
    },
    onCloseWindow: function(xulWindow) {},
    onWindowTitleChange: function(xulWindow, newTitle) {}
  };

  //default position to store toolbarbutton
  function toolButtonLoc()
  {
    switch(Services.appinfo.ID) {
    case "{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}": //PM
      return ["nav-bar","urlbar-display-box"];
    case "{3550f703-e582-4d05-9a08-453d09bdfdc6}": //TB
      return ["mail-toolbar-menubar2","menubar-items"];
    case "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}": //SM
      return ["nav-bar","nav-bar-inner"];
    default: //FF (probably)
      if (Services.vc.compare(Services.appinfo.version, "29.*") >= 0)
        return ["nav-bar-customization-target","urlbar-container"];
      else //FF < 29
        return ["nav-bar","urlbar-container"];
    }
  }
function install(){}
function uninstall(){}

//https://github.com/dgutov/bmreplace
/* jshint ignore:start */
var self = this,
icon,
prefHandlers = [];

var prefsObserver = {
  observe: function(subject, topic, data) {
    if (topic == "nsPref:changed")
      prefHandlers.forEach(function(func) {func(data);});
  }
};

var addon = {
  getResourceURI: function(filePath)
  {
    return {spec: __SCRIPT_URI_SPEC__ + "/../" + filePath};
  }
};

function $(node, childId)
{
  if (node.getElementById)
    return node.getElementById(childId);
  else
    return node.querySelector("#" + childId);
}
/* jshint ignore:end */
