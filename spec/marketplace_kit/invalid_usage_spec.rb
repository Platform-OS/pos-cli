describe "invalid usage" do
  it 'aborts with usage when no arguments passed' do
    expect{execute_command('') }.to raise_error("Usage: nearme-marketpalce sync | deploy | pull")
  end

  it 'aborts when no .builder file found' do
    expect(File).to receive(:read).with("#{MarketplaceKit.builder_folder}.builder").and_raise(Errno::ENOENT)
    expect{execute_command('sync') }.to raise_error("Please create .builder file in order to continue.")
  end
end
