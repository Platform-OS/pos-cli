describe 'help commands' do
  context '--help' do
    subject { execute_command('--help') }

    it 'displays help message' do
      expect { subject }.to output(
"marketplace-kit #{MarketplaceKit::VERSION}
Usage: marketplace-kit sync | deploy | pull
  -e endpoint     endpoint from your config file
  -v              show current version
").to_stdout
    end
  end

  context '--version' do
    it 'displays version message' do
      expect { execute_command('--version') }.to output(/marketplace-kit #{MarketplaceKit::VERSION}/).to_stdout
      expect { execute_command('-v') }.to output(/marketplace-kit #{MarketplaceKit::VERSION}/).to_stdout
    end
  end
end
