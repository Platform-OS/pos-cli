describe 'help command' do
  subject { execute_command('--help') }

  it 'displays help message' do
    expect { subject }.to output(/Sync mode enabled/).to_stdout
  end
end
