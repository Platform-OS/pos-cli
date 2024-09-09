# Contributing to platformOS Check

## Standards

* PR should explain what the feature does, and why the change exists.
* PR should include any carrier specific documentation explaining how it works.
* Code _must_ be tested.
* Be consistent. Write clean code.
* Code should be generic and reusable.

## How to contribute

1. Fork it (https://github.com/Platform-OS/pos-cli).
2. Go into the forked repository (`cd po-cli`) and link the repo: `npm unlink .; npm uninstall -g @platformOS/pos-cli; npm link; npm install`
2. Create your feature branch (`git checkout -b my-new-feature`).
3. Commit your changes (`git commit -am 'Add some feature'`).
4. Push to the branch (`git push origin my-new-feature`).
5. Create a new Pull Request.

## Running Tests

```
npm run test
```

