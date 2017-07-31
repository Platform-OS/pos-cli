RSpec.configure do |config|
  config.before(:each) do
    allow_any_instance_of(Object).to receive(:sleep).and_return(nil)
    allow_any_instance_of(Object).to receive(:system).and_call_original
    allow_any_instance_of(Object).to receive(:system).with("curl -o marketplace_release.zip 'http://fake-zip-file-url.com'").and_return(nil)
    allow_any_instance_of(Object).to receive(:system).with('unzip -o marketplace_release.zip -d marketplace_builder').and_return(nil)
  end
end
