describe "invalid usage" do
  context "no arguments" do
    let(:command_dispatcher) { MarketplaceKit::CommandDispatcher }

    it 'aborts with usage when no arguments passed' do
      expect{command_dispatcher.new([]).execute}.to raise_error("Usage: nearme-marketpalce sync | deploy | pull")
    end
  end
end
