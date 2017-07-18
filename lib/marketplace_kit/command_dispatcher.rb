module MarketplaceKit
  class CommandDispatcher
    def initialize(args)
      @args = args
    end

    def execute
      unless ENV['LOCALHOST_TOKEN']
        puts "Enter your email"
        email = STDIN.gets.chomp

        puts "Enter your password"
        password = STDIN.noecho(&:gets).chomp

        response = gateway.login(email, password)
        if response[:status] == 401
          raise('Error: Invalid email or password!')
        else
          ENV['LOCALHOST_TOKEN'] = response[:body]['token']
        end
      end

      command.new.execute
    end

    private

    def command
      @command ||= case command_name
        when "sync"   then Commands::Sync
        when "deploy" then Commands::Deploy
        else raise("Usage: nearme-marketpalce sync | deploy | pull")
      end
    end

    def command_name
      @args[0]
    end

    def gateway
      @gateway ||= Services::ApiGateway.new
    end
  end
end
