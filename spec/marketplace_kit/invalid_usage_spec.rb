describe "invalid usage" do
  context "no arguments" do
    it 'aborts with usage when no arguments passed' do
      expect{execute_command('') }.to raise_error("Usage: nearme-marketpalce sync | deploy | pull")
    end
  end
end
