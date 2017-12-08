# coding: utf-8

describe 'ApiDriver' do
  subject { MarketplaceKit::Services::ApiDriver.new(:post, 'foo', body, {}).send_request }
  let(:body) { {
      path: 'pages/faq.liquid',
      marketplace_builder_file_body: %q{
---
name: "This ’ apostrophe is a problem"
---
foo
}
               } }

  before(:each) do
    stub_request(:post, "http://localhost:3000/api/marketplace_builder/foo")
      .with(body: "{\"path\":\"pages/faq.liquid\",\"marketplace_builder_file_body\":\"\\n---\\nname: \\\"This ’ apostrophe is a problem\\\"\\n---\\nfoo\\n\"}")
      .to_return(status: 200, body: ''.to_json)
  end

  it 'dont mess with encoding' do
    MarketplaceKit.config.load('localhost')
    expect(subject.success?).to be true
  end
end
