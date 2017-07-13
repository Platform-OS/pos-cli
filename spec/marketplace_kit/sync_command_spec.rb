describe "sync command" do
  let(:command_dispatcher) { MarketplaceKit::CommandDispatcher }
  subject { command_dispatcher.new(['sync']).execute }

  before(:each) do
    fake_listener = double

    allow(Listen).to receive(:to) do |*args, &block|
      allow(fake_listener).to receive(:file_changed_block).and_return(block)
      fake_listener
    end

    expect(fake_listener).to receive(:start) do
      fake_listener.file_changed_block.call ["#{MarketplaceKit.root}/spec/example_marketplace/liquid_views/index.liquid"], [], []
    end

    stub_request(:put, 'http://localhost:3000/api/marketplace_releases/sync').to_return(status: 200)
  end

  it 'displays ready message' do
    expect { subject }.to output(/Sync mode enabled/).to_stdout
  end

  it 'sleeps till user exit' do
    expect_any_instance_of(Object).to receive(:sleep).and_return(nil)
    subject
  end

  it 'sends API call with modified file' do
    subject

    expect(a_request(:put, "http://localhost:3000/api/marketplace_releases/sync").with( body: {
      path: 'liquid_views/index.liquid',
      body: "<h1>Hello</h1>\n"
    }.to_json)).to have_been_made
  end
end
