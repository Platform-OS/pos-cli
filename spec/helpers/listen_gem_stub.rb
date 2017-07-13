module Helpers
  module ListenGemStub
    def stub_listen_gem
      fake_listener = double(start: nil)

      allow(Listen).to receive(:to) do |*args, &block|
        allow(fake_listener).to receive(:on_file_changed).and_return(block)
        fake_listener
      end

      fake_listener
    end
  end
end
