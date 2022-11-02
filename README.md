# Vinpearl OCR

Vinpearl OCR is an open source [Electron](https://www.electronjs.org/) app
based on [GitHub Desktop](https://desktop.github.com/). It is written in [TypeScript](https://www.typescriptlang.org) and
uses [React](https://reactjs.org/).

## Building Desktop

### Verification

Verify you have these commands available in your shell and that the found
versions look similar to the below output:

```shellsession
$ node -v
v16.13.0

$ yarn -v
1.21.1

$ python --version
Python 3.9.x
```

### Building

You'll need to be inside the repository in order to build the application locally.

The typical workflow to get up running is as follows:

* Run `yarn` to get all required dependencies on your machine.
* Run `yarn build:dev` to create a development build of the app.
* Run `yarn start` to launch the application. Changes will be compiled in the
  background. The app can then be reloaded to see the changes (<kbd>F5</kbd>).

**Optional Tip**: On macOS and Linux, you can use `screen` to avoid filling your terminal with logging output:

```shellsession
$ screen -S "desktop" yarn start # -S sets the name of the session; you can pick anything
$ # Your screen clears and shows logs. Press Ctrl+A then D to exit.
[detached]
$ screen -R "desktop" # to reopen the session, read the logs, and exit (Ctrl+C)
[screen is terminating]
```

If you've made changes in the `main-process` folder you need to run `yarn
build:dev` to rebuild the package, and then `yarn start` for these changes to be
reflected in the running app.

### Running tests

* `yarn test` - Runs all unit and integration tests
* `yarn test:unit` - Runs all unit tests
  * Add `<file>` or `<pattern>` argument to only run tests in the specified file or files matching a pattern
  * Add `-t <regex>` to only match tests whose name matches a regex

### Debugging

Electron ships with Chrome Dev Tools to assist with debugging, profiling and
other measurement tools.

1. Run the command `yarn start` to launch the app
2. Under the **View** menu, select **Toggle Developer Tools**

When running the app in development mode,
[React Dev Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi?hl=en)
should automatically install itself on first start when in development mode.

An additional extension, [Devtron](http://electron.atom.io/devtron/), is also
included but is disabled by default. To enable Devtron, select the Console
tab in Chrome Developer Tools and run this command:

```js
require('devtron').install()
```

## More Resources

See [desktop.github.com](https://desktop.github.com) for more product-oriented
information about GitHub Desktop.

See our [getting started documentation](https://docs.github.com/en/desktop/installing-and-configuring-github-desktop/overview/getting-started-with-github-desktop) for more information on how to set up, authenticate, and configure GitHub Desktop.

## License

**[MIT](LICENSE)**

The MIT license grant is not for GitHub's trademarks, which include the logo
designs. GitHub reserves all trademark and copyright rights in and to all
GitHub trademarks. GitHub's logos include, for instance, the stylized
Invertocat designs that include "logo" in the file title in the following
folder: [logos](app/static/logos).

GitHub® and its stylized versions and the Invertocat mark are GitHub's
Trademarks or registered Trademarks. When using GitHub's logos, be sure to
follow the GitHub [logo guidelines](https://github.com/logos).
