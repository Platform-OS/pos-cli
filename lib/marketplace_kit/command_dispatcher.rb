module MarketplaceKit
  class CommandDispatcher
    def initialize(args)
      @args = args
    end

    def execute
      puts @args
    end
  end
end
