# MarketplaceKit contribute guide
How to develop, test and release new version of the gem

When setting new version to release, please read [SemVer](http://semver.org/).

## Test

    rake spec

## Test locally

1. Change code
2. `gem build marketplace_kit.gemspec`
3. `gem install marketplace-kit-x.x.x.gem`
4. Run `marketplace-kit`

## Release

1. `gem build marketplace_kit.gemspec`
2. `gem push marketplace-kit-x.x.x.gem`
3. Create git tag `git tag vx.x.x; git push origin --tags`
