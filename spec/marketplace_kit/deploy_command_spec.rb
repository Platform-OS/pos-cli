describe 'deploy command' do
  subject { execute_command('deploy') }

  before(:each) do
    stub_request(:post, 'http://localhost:3000/api/marketplace_builder/marketplace_releases').to_return(status: 200, body: { id: 1 }.to_json)
  end

  it 'displays start message' do
    expect { subject }.to output(/Deploy command started!/).to_stdout
  end

  it 'sends API call with proper zip file' do
    expect_any_instance_of(Faraday::Connection).to receive(:post) do |_, reques_url, request_body|
      unzip_zip_from_mocked_request(request_body)

      expect(reques_url).to eq('api/marketplace_builder/marketplace_releases')
      expect(File.read('tmp/zip_file_from_request/liquid_views/index.liquid')).to eq("<h1>Hello</h1>\n")

      OpenStruct.new(status: 200, body: { id: 1 }.to_json)
    end

    subject
  end

  it 'sends API call without force mode as default' do
    subject

    expect(a_request(:post, 'http://localhost:3000/api/marketplace_builder/marketplace_releases').with { |req|
      expect(req.body).to match(/Content-Disposition: form-data; name="marketplace_builder\[force_mode\]"\s+false/)
    }).to have_been_made
  end

  it 'sends API call with force mode if -f passed' do
    execute_command('deploy -f')

    expect(a_request(:post, 'http://localhost:3000/api/marketplace_builder/marketplace_releases').with { |req|
      expect(req.body).to match(/Content-Disposition: form-data; name="marketplace_builder\[force_mode\]"\s+true/)
    }).to have_been_made
  end

  it 'waits for deploy to finish' do
    @request_counter = 0

    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/1').to_return do
      if @request_counter >= 5
        { status: 200, body: { id: 1, status: 'success' }.to_json }
      else
        @request_counter += 1
        { status: 200, body: { id: 1, status: 'ready_for_import' }.to_json }
      end
    end

    expect_any_instance_of(Object).to receive(:sleep).exactly(5).times.and_return(nil)
    expect { execute_command('deploy') }.to output(/.....success/).to_stdout
  end

  it 'waits for deploy and displays error' do
    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/1').to_return(status: 200, body: {
      id: 1, status: 'error', error: { message: "Template path has already been taken", details: { model_id: 1, model_class: 'Workflow' }}.to_json
    }.to_json)

    expect { execute_command('deploy') }.to output(/Builder error: Template path has already been taken/).to_stdout
    expect { execute_command('deploy') }.to output(/"model_class"=>"Workflow"/).to_stdout
  end

  def unzip_zip_from_mocked_request(request_body)
    File.open('tmp/zip_file_from_request.zip', 'w') do |file|
      file.write(request_body[:marketplace_builder][:zip_file].read)
    end

    system 'unzip -o tmp/zip_file_from_request.zip -d tmp/zip_file_from_request'
  end
end
