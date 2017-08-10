# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'marketplace_kit/version'

Gem::Specification.new do |spec|
  spec.name          = 'marketplace-kit'
  spec.version       = MarketplaceKit::VERSION
  spec.authors       = ['Michal Janeczek']
  spec.email         = ['support@near-me.com']

  spec.summary       = 'Marketplace Kit'
  spec.description   = 'Marketplace Kit'
  spec.homepage      = 'https://marketplaceplatform.com'

  # Prevent pushing this gem to RubyGems.org. To allow pushes either set the 'allowed_push_host'
  # to allow pushing to a single host or delete this section to allow pushing to any host.
  if spec.respond_to?(:metadata)
    spec.metadata['allowed_push_host'] = "TODO: Set to 'http://mygemserver.com'"
  else
    raise 'RubyGems 2.0 or newer is required to protect against ' \
      'public gem pushes.'
  end

  spec.files = `git ls-files -z`.split("\x0").reject do |f|
    f.match(%r{^(test|spec|features)/})
  end

  spec.bindir        = 'bin'
  spec.executables   = ['marketplace-kit']
  spec.require_paths = ['lib']

  spec.add_development_dependency 'bundler', '~> 1.13'
  spec.add_development_dependency 'rake', '~> 10.0'
  spec.add_development_dependency 'rspec', '~> 3.0'
  spec.add_development_dependency 'rspec-mocks'
  spec.add_development_dependency 'webmock'
  spec.add_development_dependency 'simplecov'
  spec.add_development_dependency 'coveralls'

  spec.add_dependency 'listen'
  spec.add_dependency 'faraday'
  spec.add_dependency 'colorize'
  spec.add_dependency 'deep_merge'
end
