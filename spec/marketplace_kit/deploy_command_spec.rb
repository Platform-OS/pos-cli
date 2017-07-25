describe 'deploy command' do
  subject { execute_command('deploy') }

  before(:each) do
    stub_request(:post, 'http://localhost:3000/api/marketplace_builder/marketplace_releases').to_return(status: 200, body: {}.to_json)
  end

  it 'displays start message' do
    expect { subject }.to output(/Deploy command started!/).to_stdout
  end

  it 'sends API call with proper zip file' do
    expect_any_instance_of(Faraday::Connection).to receive(:post) do |_, reques_url, request_body|
      unzip_zip_from_mocked_request(request_body)

      expect(reques_url).to eq('api/marketplace_builder/marketplace_releases')
      expect(File.read('tmp/zip_file_from_request/liquid_views/index.liquid')).to eq("<h1>Hello</h1>\n")

      OpenStruct.new(status: 200, body: {}.to_json)
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

  def unzip_zip_from_mocked_request(request_body)
    File.open('tmp/zip_file_from_request.zip', 'w') do |file|
      file.write(request_body[:marketplace_builder][:zip_file].read)
    end

    system 'unzip -o tmp/zip_file_from_request.zip -d tmp/zip_file_from_request'
  end
end
