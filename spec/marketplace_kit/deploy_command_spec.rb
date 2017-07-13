describe "deploy command" do
  subject { execute_command("deploy") }

  before(:each) do
    stub_request(:post, 'http://localhost:3000/api/marketplace_releases').to_return(status: 200)
  end

  it 'displays start message' do
    expect { subject }.to output(/Deploy command started!/).to_stdout
  end

  it 'sends API call with proper zip file' do
    expect_any_instance_of(Faraday::Connection).to receive(:post) do |_, reques_url, request_body|
      expect(reques_url).to eq('api/marketplace_releases')
      File.open('tmp/zip_file_from_request.zip', 'w') { |file| file.write(request_body[:marketplace_builder][:zip_file].read) }
      system "unzip -o tmp/zip_file_from_request.zip -d tmp/zip_file_from_request"
      expect(File.read('tmp/zip_file_from_request/liquid_views/index.liquid')).to eq("<h1>Hello</h1>\n")
    end

    subject
  end
end
