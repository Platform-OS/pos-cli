describe 'pull command' do
  subject { execute_command('pull') }

  before(:each) do
    stub_request(:post, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/backup').to_return(status: 200, body: { id: 1 }.to_json)
  end

  it 'displays start message' do
    expect { subject }.to output(/Pull command started!/).to_stdout
  end

  it 'sends API call to schedule a backup' do
    subject

    expect(a_request(:post, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/backup')).to have_been_made
  end

  it 'waits for backup to finish' do
    @request_counter = 0

    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/1').to_return do
      if @request_counter >= 5
        { status: 200, body: { id: 1, status: 'success', zip_file: { url: 'http://fake-zip-file-url.com' } }.to_json }
      else
        @request_counter += 1
        { status: 200, body: { id: 1, status: 'ready_for_export' }.to_json }
      end
    end

    expect_any_instance_of(Object).to receive(:sleep).exactly(5).times.and_return(nil)
    expect { execute_command('pull') }.to output(/.....success/).to_stdout
  end

  it 'waits for backup and displays error' do
    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/1').to_return(status: 200, body: {
      id: 1, status: 'error', error: { message: 'Template path has already been taken', details: { model_id: 1, model_class: 'Workflow' } }.to_json
    }.to_json)

    expect { execute_command('pull') }.to output(/Builder error: Template path has already been taken/).to_stdout
    expect { execute_command('pull') }.to output(/"model_class"=>"Workflow"/).to_stdout
  end

  it 'executes curl and unzip if pull was success' do
    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/1').to_return(status: 200, body: {
      id: 1, status: 'success', zip_file: { url: 'http://fake-zip-file-url.com' }
    }.to_json)

    expect_any_instance_of(Object).to receive(:system).with("curl -o marketplace_release.zip 'http://fake-zip-file-url.com'").once
    expect_any_instance_of(Object).to receive(:system).with('unzip -o marketplace_release.zip -d marketplace_builder').once

    execute_command('pull')
  end

  it 'does not curl and unzip if error occured' do
    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/1').to_return(status: 200, body: {
      id: 1, status: 'error', error: { message: 'Template path has already been taken', details: { model_id: 1, model_class: 'Workflow' } }.to_json
    }.to_json)

    expect_any_instance_of(Object).to_not receive(:system).with("curl -o marketplace_release.zip 'http://fake-zip-file-url.com'")
    expect_any_instance_of(Object).to_not receive(:system).with('unzip -o marketplace_release.zip -d marketplace_builder')

    execute_command('pull')
  end
end
