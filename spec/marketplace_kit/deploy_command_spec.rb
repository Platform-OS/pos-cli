describe 'deploy command' do
  subject { execute_command('deploy') }

  before(:each) do
    stub_request(:post, 'http://localhost:3000/api/marketplace_builder/marketplace_releases').to_return(status: 200, body: { id: 1 }.to_json)
    stub_request(:get, "http://localhost:3000/api/marketplace_builder/settings").to_return(
      status: 200,
      body: { manifest: {
                '/liquid_views/index.liquid' => { 'md5' => '86588137cb4fa781fcf1f5f4f294d201'},
                '/liquid_views/unchanged_file.liquid' => { 'md5' => 'd41d8cd98f00b204e9800998ecf8427e'},
                '/custom_themes/default_custom_theme/foo.txt' => { 'md5' => 'd41d8cd98f00b204e9800998ecf8427e' },
                '/custom_themes/default_custom_theme/foo_unchanged.txt' => { 'md5' => 'be367fa3a96ffb1989b2e3196c3e6774' }
              }}.to_json
    )
  end

  it 'sends API call with proper zip file' do
    expect_any_instance_of(Faraday::Connection).to receive(:post) do |_, reques_url, request_body|
      unzip_zip_from_mocked_request(request_body)

      expect(reques_url).to eq('api/marketplace_builder/marketplace_releases')
      expect(File.read('tmp/zip_file_from_request/liquid_views/index.liquid')).to eq("<h1>Hello</h1>\n")
      expect(File.exists?('tmp/zip_file_from_request/liquid_views/unchanged_file.liquid')).to(be true)
      expect(File.exists?('tmp/zip_file_from_request/custom_themes/default_custom_theme/foo.txt')).to(be true)
      expect(File.exists?('tmp/zip_file_from_request/custom_themes/default_custom_theme/foo_unchanged.txt')).to(be false)
      manifest = request_body.dig(:marketplace_builder, :manifest)
      expect(manifest).to include('/custom_themes/default_custom_theme/foo.txt' => { 'md5' => 'd3b07384d113edec49eaa6238ad5ff00' })
      expect(manifest).to include('/custom_themes/default_custom_theme/foo_unchanged.txt' => { 'md5' => 'be367fa3a96ffb1989b2e3196c3e6774' })
      expect(manifest).to include("/liquid_views/index.liquid" => {"md5"=>"86588137cb4fa781fcf1f5f4f294d200"})
      expect(manifest).to include('/liquid_views/unchanged_file.liquid' => { 'md5' => 'd41d8cd98f00b204e9800998ecf8427e'})

      OpenStruct.new(status: 200, body: { id: 1 }.to_json)
    end

    subject
  end

  it 'sends API call without force mode as default' do
    subject

    expect(a_request(:post, 'http://localhost:3000/api/marketplace_builder/marketplace_releases').with do |req|
      expect(req.body).to match(/Content-Disposition: form-data; name="marketplace_builder\[force_mode\]"\s+false/)
    end).to have_been_made
  end

  it 'sends API call with force mode if -f passed' do
    execute_command('deploy -f')

    expect(a_request(:post, 'http://localhost:3000/api/marketplace_builder/marketplace_releases').with do |req|
      expect(req.body).to match(/Content-Disposition: form-data; name="marketplace_builder\[force_mode\]"\s+true/)
    end).to have_been_made
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
    expect { execute_command('deploy') }.to output(/.....Deploy command succeded/).to_stdout
  end

  it 'waits for deploy and displays error' do
    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/1').to_return(status: 200, body: {
      id: 1, status: 'error', error: { message: 'Template path has already been taken', details: { model_id: 1, model_class: 'Workflow' } }.to_json
    }.to_json)

    expect { execute_command('deploy') }.to raise_error SystemExit    
  end

  it 'displays start message' do
    expect { subject }.to output(/Deploy command started/).to_stdout
  end

  def unzip_zip_from_mocked_request(request_body)
    system 'rm -f tmp/zip_file_from_request.zip'
    system 'rm -rf tmp/zip_file_from_request/'
    File.open('tmp/zip_file_from_request.zip', 'w') do |file|
      file.write(request_body[:marketplace_builder][:zip_file].read)
    end

    system 'unzip -o tmp/zip_file_from_request.zip -d tmp/zip_file_from_request'
  end
end
