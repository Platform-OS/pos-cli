describe "sync command" do
  let(:command_dispatcher) { MarketplaceKit::CommandDispatcher }

  it 'displays ready message' do
    expect { command_dispatcher.new(['sync']).execute }.to output(/Sync mode enabled/).to_stdout
  end
end
